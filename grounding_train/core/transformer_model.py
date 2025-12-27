
import torch
import torch.nn as nn
import torch.nn.functional as F

class SimpleCNN(nn.Module):
    """
    A simple 4-layer CNN to extract features.
    Downsamples input by 16x (e.g. 256x256 -> 16x16)
    """
    def __init__(self, hidden_dim=256):
        super().__init__()
        self.conv1 = nn.Conv2d(3, 64, kernel_size=3, stride=2, padding=1)   # -> 1/2
        self.conv2 = nn.Conv2d(64, 128, kernel_size=3, stride=2, padding=1)  # -> 1/4
        self.conv3 = nn.Conv2d(128, 256, kernel_size=3, stride=2, padding=1) # -> 1/8
        self.conv4 = nn.Conv2d(256, hidden_dim, kernel_size=3, stride=2, padding=1) # -> 1/16
        self.bn1 = nn.BatchNorm2d(64)
        self.bn2 = nn.BatchNorm2d(128)
        self.bn3 = nn.BatchNorm2d(256)
        self.bn4 = nn.BatchNorm2d(hidden_dim)

    def forward(self, x):
        x = F.relu(self.bn1(self.conv1(x)))
        x = F.relu(self.bn2(self.conv2(x)))
        x = F.relu(self.bn3(self.conv3(x)))
        x = F.relu(self.bn4(self.conv4(x)))
        return x

class PositionalEncoding(nn.Module):
    """
    Fixed sinusoidal positional encoding
    """
    def __init__(self, d_model, max_len=5000):
        super().__init__()
        # Simple implementation for 2D images flattened
        # Or just use learnable for simplicity in this demo
        self.row_embed = nn.Embedding(50, d_model // 2)
        self.col_embed = nn.Embedding(50, d_model // 2)

    def forward(self, h, w, device):
        rows = torch.arange(h, device=device)
        cols = torch.arange(w, device=device)
        x_emb = self.col_embed(cols)
        y_emb = self.row_embed(rows)
        
        # Meshgrid
        pe = torch.cat([
            x_emb.unsqueeze(0).repeat(h, 1, 1),
            y_emb.unsqueeze(1).repeat(1, w, 1),
        ], dim=-1).permute(2, 0, 1).unsqueeze(0) # [1, d_model, h, w]
        return pe.flatten(2).permute(0, 2, 1) # [1, h*w, d_model]

class TransformerBBox(nn.Module):
    def __init__(self, hidden_dim=256, nheads=8, num_layers=2):
        super().__init__()
        self.backbone = SimpleCNN(hidden_dim)
        self.pos_enc = PositionalEncoding(hidden_dim)
        
        self.transformer_decoder = nn.TransformerDecoder(
            nn.TransformerDecoderLayer(d_model=hidden_dim, nhead=nheads, batch_first=True),
            num_layers=num_layers
        )
        
        # Learnable Query Token (for 1 object)
        self.query_embed = nn.Embedding(1, hidden_dim)
        
        # Prediction Head
        self.bbox_head = nn.Linear(hidden_dim, 4) # cx, cy, w, h
        
        self.last_attention_weights = None

        # Hook for attention
        # We need to register a hook on the last decoder layer's multihead attention
        # But nn.TransformerDecoderLayer doesn't easily expose weights unless we use custom implementation
        # OR we can rely on `grad` or modify forwarding.
        # For simplicity, let's allow the model to return hidden states and we'll visualize based on a simplified manual attention calc if needed,
        # BUT `nn.TransformerDecoder` standard does not return attention weights.
        # We will wrap the decoder layer to capture weights or use a simplified manual attention block for the last layer.
        
        # Alternative: Replace the last layer with a custom one that saves weights.
    
    def forward(self, x):
        # Backbone
        features = self.backbone(x) # [B, C, H, W]
        b, c, h, w = features.shape
        
        # Positional Encoding
        pos = self.pos_enc(h, w, x.device) # [1, L, C] where L = H*W
        
        # Flatten features for Transformer
        src = features.flatten(2).permute(0, 2, 1) # [B, L, C]
        src_pos = src + pos.repeat(b, 1, 1)
        
        # Query
        query = self.query_embed.weight.unsqueeze(0).repeat(b, 1, 1) # [B, 1, C]
        
        # Transformer Decoder
        # Valid output: [B, 1, C]
        # We want to capture attention here. 
        # Standard nn.Module doesn't support outputting weights directly easily.
        # So we will just run it. 
        # *Self-Attention* in decoder is trivial (1 token).
        # *Cross-Attention* is what we care about (Query vs Image Features).
        
        hs = self.transformer_decoder(tgt=query, memory=src_pos)
        
        outputs = self.bbox_head(hs.squeeze(1)) # [B, 4]
        outputs = torch.sigmoid(outputs) # Normalize to 0-1
        
        return outputs

    def get_attention_map(self, x):
        """
        Extract attention map manually for visualization.
        This re-runs a simplified attention calculation to show what the model *would* be looking at.
        """
        with torch.no_grad():
            features = self.backbone(x)
            b, c, h, w = features.shape
            pos = self.pos_enc(h, w, x.device)
            src = features.flatten(2).permute(0, 2, 1)
            src_pos = src + pos.repeat(b, 1, 1)
            
            # Get the query (after passing through layers if we had multiple, 
            # but for 1 layer or simplified, we can use the learned query approx)
            # Better: use hooks.
            pass
        return None

# Custom Block to capture attention
class AttentionBlock(nn.Module):
    def __init__(self, dim, num_heads=8):
        super().__init__()
        self.mha = nn.MultiheadAttention(dim, num_heads, batch_first=True)
        self.dropout = nn.Dropout(0.1)
        self.norm = nn.LayerNorm(dim)
        self.last_attn_weights = None
        
    def forward(self, query, key_value):
        # Query: [B, 1, C], Key_Value: [B, L, C]
        attn_out, attn_weights = self.mha(query, key_value, key_value, need_weights=True)
        self.last_attn_weights = attn_weights # [B, 1, L]
        return self.norm(query + self.dropout(attn_out))

class TransformerBBoxWithAttn(nn.Module):
    def __init__(self, hidden_dim=256, nheads=8, num_classes=91):
        super().__init__()
        self.backbone = SimpleCNN(hidden_dim)
        self.pos_enc = PositionalEncoding(hidden_dim)
        
        # Simplified: 1 Cross Attention Layer for demo
        self.cross_attn = AttentionBlock(hidden_dim, nheads)
        self.ffn = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim * 4),
            nn.ReLU(),
            nn.Linear(hidden_dim * 4, hidden_dim),
            nn.LayerNorm(hidden_dim)
        )
        
        # Conditional Query: One query vector per class
        self.query_embed = nn.Embedding(num_classes, hidden_dim)
        
        self.bbox_head = nn.Linear(hidden_dim, 4)

    def forward(self, x, category_ids):
        # x: [B, 3, H, W]
        # category_ids: [B] or [B, 1]
        
        features = self.backbone(x) # [B, C, H, W]
        b, c, h, w = features.shape
        pos = self.pos_enc(h, w, x.device)
        
        src = features.flatten(2).permute(0, 2, 1) # [B, L, C]
        src_pos = src + pos.repeat(b, 1, 1)
        
        # Get query for the specific category
        # category_ids shape [B] -> [B, 1]
        if category_ids.dim() == 1:
            category_ids = category_ids.unsqueeze(1)
            
        query = self.query_embed(category_ids) # [B, 1, C]
        
        # Cross Attention
        hs = self.cross_attn(query, src_pos)
        
        # FFN
        hs = hs + self.ffn(hs)
        
        outputs = self.bbox_head(hs.squeeze(1))
        outputs = torch.sigmoid(outputs)
        
        return outputs
