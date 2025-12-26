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
 * 构建图片浏览器UI - 简化版（只显示3个按钮）
 */
function buildImageExplorerUI(container) {
  container.html(''); // 清空容器

  // 简单布局
  const explorerDiv = container.append('div')
    .style('display', 'flex')
    .style('align-items', 'center')
    .style('justify-content', 'center')
    .style('background', '#f8fafc')
    .style('padding', '40px')
    .style('min-height', '550px');

  // 只放placeholder，实际按钮由HTML生成
  explorerDiv.append('div')
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
