/**
 * 交互式图片浏览器 - 简化版（只显示3个图片选择）
 */

import * as d3 from "d3";
import imageListData from "../data/image_list.json";
import cocoPoseResultsData from "../data/coco_pose_results.json";

// 全局数据缓存
window.imageExplorerData = {
  imageList: imageListData,
  poseResults: cocoPoseResultsData,
  selectedImageId: null
};

/**
 * 初始化图片浏览器
 */
async function initializeImageExplorer(container) {
  console.log('[Image Explorer] Starting initialization...');
  
  try {
    console.log(`✓ Image Explorer: Loaded ${window.imageExplorerData.imageList.image_ids.length} images`);

    // 构建UI
    buildImageExplorerUI(container);
    
    // 生成按钮
    const imageIds = window.imageExplorerData.imageList.image_ids.slice(0, 3);
    generateImageSelectionButtons(imageIds);
    
    console.log('[Image Explorer] UI built successfully');
  } catch (error) {
    console.error('Image Explorer Init Error:', error);
    const errorMsg = error.message || String(error);
    container.html(`
      <div style="padding:40px; text-align:center; color:#ef4444; background:#fee; border-radius:8px;">
        <div style="font-size:48px; margin-bottom:16px;">⚠️</div>
        <div style="font-size:18px; margin-bottom:8px; font-weight:600;">图片浏览器加载失败</div>
      </div>
    `);
  }
}

/**
 * 构建图片浏览器UI - 只显示3个按钮，无背景框架
 */
function buildImageExplorerUI(container) {
  container.html(''); // 清空容器

  // 直接创建按钮容器，无背景
  container.append('div')
    .attr('id', 'image-explorer-wrapper')
    .style('width', '100%');
}

/**
 * 显示图片
 */
function displayImage(imageId) {
  const modal = document.getElementById(`image-modal-${imageId}`);
  if (modal) {
    modal.classList.add('active');
  }
}

/**
 * 生成图片选择按钮
 */
function generateImageSelectionButtons(imageIds) {
  const container = document.getElementById('image-explorer-wrapper');
  if (!container) {
    console.error('image-explorer-wrapper container not found');
    return;
  }
  
  let buttonsHtml = `
    <div style="display: flex; flex-direction: column; gap: 16px; align-items: center;">
      <div style="text-align: center; margin-bottom: 8px;">
        <div style="font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 6px;">
          ⬇️ 点击选择图像查看YOLOv8推理结果
        </div>
        <div style="font-size: 12px; color: #64748b; line-height: 1.5;">
          从175张COCO数据集中选择示例 • 对比原始图像与推理可视化 • 查看17个关键点的置信度热力图
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; width: 100%;">`;
  
  imageIds.forEach((imageId, index) => {
      buttonsHtml += `
          <button class="ghost-btn" onclick="document.getElementById('image-modal-${imageId}').classList.add('active')" 
                  style="
                    height: 50px; 
                    padding: 0 16px; 
                    font-size: 14px; 
                    font-weight: 600;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
                  "
                  onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(102, 126, 234, 0.4)';"
                  onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.3)';">
              📸 示例 ${index + 1}
          </button>`;
  });
  
  buttonsHtml += `</div></div>`;
  
  container.innerHTML = buttonsHtml;
}

/**
 * 导出初始化函数供外部调用
 */
export function initImageExplorer(containerId) {
  console.log(`[Image Explorer] ========== INIT CALLED ==========`);
  
  const container = d3.select(`#${containerId}`);
  
  if (!container.empty()) {
    console.log('[Image Explorer] Calling initializeImageExplorer...');
    initializeImageExplorer(container);
  } else {
    console.error(`[Image Explorer] Container #${containerId} not found in DOM`);
  }
}

// 也暴露到全局，保持兼容性
window.initImageExplorer = initImageExplorer;
