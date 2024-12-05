// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getProductNames") {
      const products = request.products;

      // Django 서버로 상품 목록 전송
      fetch('http://localhost:8000/api/recommend/', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({ selected_products: products }),
      })
      .then(response => response.json())
      .then(data => {
          // 추천 결과를 팝업으로 전송
          chrome.runtime.sendMessage({ action: "showRecommendations", recommended: data.recommended_products });
      })
      .catch(error => console.error('Error:', error));
  }
});
