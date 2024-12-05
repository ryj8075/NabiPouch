// content.js
const productNames = [];

// 상품 이름을 가져오는 코드
document.querySelectorAll(".prd_name .tx_name").forEach(product => {
    productNames.push(product.textContent.trim());
});

// 상품 목록을 background script로 전송
chrome.runtime.sendMessage({ action: "getProductNames", products: productNames });
