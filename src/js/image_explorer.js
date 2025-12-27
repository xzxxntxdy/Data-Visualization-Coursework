/**
 * 交互式图片浏览器 - 轮播版（直接显示图片，带切换按钮）
 */

import * as d3 from "d3";
import imageListData from "../data/image_list.json";
import cocoPoseResultsData from "../data/coco_pose_results.json";

// 导入图片让 Parcel 正确处理
import img785 from "../visualized/000000000785_viz.jpg";
import img8021 from "../visualized/000000008021_viz.jpg";
import img9483 from "../visualized/000000009483_viz.jpg";

// 图片映射表
const IMAGE_MAP = {
  '000000000785': img785,
  '000000008021': img8021,
  '000000009483': img9483
};

// 全局数据缓存
window.imageExplorerData = {
  imageList: imageListData,
  poseResults: cocoPoseResultsData,
  selectedImageId: null,
  currentIndex: 0,
  imageIds: []
};

/**
 * 初始化图片浏览器
 */
async function initializeImageExplorer(container) {
  console.log('[Image Explorer] Starting initialization...');
  
  try {
    // 获取前3张图片ID
    window.imageExplorerData.imageIds = window.imageExplorerData.imageList.image_ids.slice(0, 3);
    window.imageExplorerData.currentIndex = 0;
    
    console.log(`✓ Image Explorer: Loaded ${window.imageExplorerData.imageIds.length} images for carousel`);

    // 构建轮播UI
    buildCarouselUI(container);
    
    console.log('[Image Explorer] Carousel UI built successfully');
  } catch (error) {
    console.error('Image Explorer Init Error:', error);
    container.html(`
      <div style="padding:40px; text-align:center; color:#ef4444; background:#fee; border-radius:8px;">
        <div style="font-size:48px; margin-bottom:16px;">⚠️</div>
        <div style="font-size:18px; margin-bottom:8px; font-weight:600;">图片浏览器加载失败</div>
      </div>
    `);
  }
}

/**
 * 构建轮播UI - 直接显示图片，带左右切换
 */
function buildCarouselUI(container) {
  container.html(''); // 清空容器
  
  const imageIds = window.imageExplorerData.imageIds;
  const currentIndex = window.imageExplorerData.currentIndex;
  const currentImageId = imageIds[currentIndex];
  
  const carouselHtml = `
    <div id="image-carousel" style="
      background: #ffffff;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.05);
    ">
      <!-- 标题 -->
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e2e8f0;
      ">
        <div>
          <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #1e293b;">🖼️ YOLOv8 姿态推理示例</h3>
          <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">从COCO数据集中选取的推理可视化结果</p>
        </div>
        <div style="
          display: flex;
          align-items: center;
          gap: 12px;
        ">
          <!-- 上一张按钮 -->
          <button id="carousel-prev" style="
            width: 36px;
            height: 36px;
            border: 2px solid #e2e8f0;
            border-radius: 50%;
            background: #ffffff;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            color: #64748b;
            transition: all 0.2s ease;
          " onmouseover="this.style.borderColor='#667eea'; this.style.color='#667eea'; this.style.background='#f8fafc';"
             onmouseout="this.style.borderColor='#e2e8f0'; this.style.color='#64748b'; this.style.background='#ffffff';">
            ◀
          </button>
          
          <!-- 页码指示器 -->
          <div style="
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: #f8fafc;
            border-radius: 20px;
          ">
            ${imageIds.map((_, idx) => `
              <span style="
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: ${idx === currentIndex ? '#667eea' : '#d1d5db'};
                transition: all 0.2s ease;
              "></span>
            `).join('')}
            <span style="margin-left: 6px; font-size: 12px; color: #64748b; font-weight: 600;">
              ${currentIndex + 1} / ${imageIds.length}
            </span>
          </div>
          
          <!-- 下一张按钮 -->
          <button id="carousel-next" style="
            width: 36px;
            height: 36px;
            border: 2px solid #e2e8f0;
            border-radius: 50%;
            background: #ffffff;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            color: #64748b;
            transition: all 0.2s ease;
          " onmouseover="this.style.borderColor='#667eea'; this.style.color='#667eea'; this.style.background='#f8fafc';"
             onmouseout="this.style.borderColor='#e2e8f0'; this.style.color='#64748b'; this.style.background='#ffffff';">
            ▶
          </button>
        </div>
      </div>
      
      <!-- 图片内容区域 -->
      <div style="
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      ">
        <!-- 左侧：推理可视化图片 -->
        <div style="
          padding: 16px;
          background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
          border-radius: 10px;
          border: 2px solid #667eea30;
          text-align: center;
        ">
          <p style="margin: 0 0 12px; font-size: 13px; font-weight: 600; color: #667eea;">📸 推理可视化</p>
          <img id="carousel-image" 
               alt="推理结果" 
               style="
                 max-width: 100%; 
                 max-height: 350px; 
                 border-radius: 8px; 
                 object-fit: contain;
                 box-shadow: 0 4px 12px rgba(0,0,0,0.1);
               ">
          <p id="carousel-image-id" style="margin: 10px 0 0; font-size: 12px; color: #94a3b8; font-weight: 500;">ID: ${currentImageId}</p>
        </div>
        
        <!-- 右侧：关键点信息 -->
        <div id="carousel-keypoints" style="
          padding: 16px;
          background: #f8fafc;
          border-radius: 10px;
          border: 2px solid #e2e8f0;
          overflow: auto;
          max-height: 420px;
        ">
          <p style="text-align: center; color: #94a3b8;">加载关键点数据...</p>
        </div>
      </div>
    </div>
  `;
  
  container.html(carouselHtml);
  
  // 绑定切换事件
  document.getElementById('carousel-prev').addEventListener('click', () => navigateCarousel(-1));
  document.getElementById('carousel-next').addEventListener('click', () => navigateCarousel(1));
  
  // 设置图片src - 使用导入的图片路径
  const img = document.getElementById('carousel-image');
  if (img) {
    img.src = IMAGE_MAP[currentImageId] || '';
    console.log('Setting image src to:', img.src);
    if (!IMAGE_MAP[currentImageId]) {
      console.error('No image found for ID:', currentImageId);
    }
  }
  
  // 加载当前图片的关键点数据
  loadKeypointsData(currentImageId);
}

/**
 * 切换轮播图片
 */
function navigateCarousel(direction) {
  const imageIds = window.imageExplorerData.imageIds;
  let newIndex = window.imageExplorerData.currentIndex + direction;
  
  // 循环切换
  if (newIndex < 0) newIndex = imageIds.length - 1;
  if (newIndex >= imageIds.length) newIndex = 0;
  
  window.imageExplorerData.currentIndex = newIndex;
  
  // 更新UI
  updateCarouselDisplay();
}

/**
 * 更新轮播显示
 */
function updateCarouselDisplay() {
  const imageIds = window.imageExplorerData.imageIds;
  const currentIndex = window.imageExplorerData.currentIndex;
  const currentImageId = imageIds[currentIndex];
  
  // 更新图片 - 使用导入的图片路径
  const img = document.getElementById('carousel-image');
  if (img) {
    img.style.opacity = '0.5';
    img.src = IMAGE_MAP[currentImageId] || '';
    img.onload = () => { img.style.opacity = '1'; };
  }
  
  // 更新ID显示
  const idText = document.getElementById('carousel-image-id');
  if (idText) idText.textContent = `ID: ${currentImageId}`;
  
  // 更新页码指示器
  const carousel = document.getElementById('image-carousel');
  if (carousel) {
    const dots = carousel.querySelectorAll('span[style*="border-radius: 50%"]');
    dots.forEach((dot, idx) => {
      if (idx < imageIds.length) {
        dot.style.background = idx === currentIndex ? '#667eea' : '#d1d5db';
      }
    });
    
    // 更新页码文字
    const pageText = carousel.querySelector('span[style*="margin-left: 6px"]');
    if (pageText) pageText.textContent = `${currentIndex + 1} / ${imageIds.length}`;
  }
  
  // 加载关键点数据
  loadKeypointsData(currentImageId);
}

/**
 * 加载关键点数据
 */
function loadKeypointsData(imageId) {
  const container = document.getElementById('carousel-keypoints');
  if (!container) return;
  
  const poseResults = window.imageExplorerData.poseResults;
  // 数据直接是 poseResults[imageId]，不是 poseResults.results[imageId]
  const imageData = poseResults?.[imageId];
  
  if (!imageData || !imageData.keypoints || imageData.keypoints.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #94a3b8;">
        <div style="font-size: 32px; margin-bottom: 8px;">📭</div>
        <p style="margin: 0;">无关键点数据</p>
      </div>
    `;
    return;
  }
  
  // 直接使用 keypoints 数组
  let html = `<p style="margin: 0 0 12px; font-size: 13px; font-weight: 600; color: #1e293b;">🎯 检测到 ${imageData.keypoints.length} 个关键点</p>`;
  
  html += `
    <div style="padding: 10px; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px;">
  `;
  
  imageData.keypoints.forEach((kp) => {
    const conf = kp.confidence || 0;
    const confColor = conf > 0.7 ? '#10b981' : conf > 0.5 ? '#f59e0b' : '#ef4444';
    const bgColor = conf > 0.5 ? '#f0fdf4' : '#fef2f2';
    html += `
      <div style="display: flex; justify-content: space-between; padding: 4px 6px; background: ${bgColor}; border-radius: 4px;">
        <span style="color: #64748b;">${kp.name}</span>
        <span style="color: ${confColor}; font-weight: 600;">${(conf * 100).toFixed(0)}%</span>
      </div>
    `;
  });
  
  html += `</div></div>`;
  
  container.innerHTML = html;
}

/**
 * 显示图片（兼容旧接口）
 */
function displayImage(imageId) {
  const modal = document.getElementById(`image-modal-${imageId}`);
  if (modal) {
    modal.classList.add('active');
  }
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
window.navigateCarousel = navigateCarousel;
