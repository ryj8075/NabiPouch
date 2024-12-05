document.addEventListener("DOMContentLoaded", () => {
    const userIdInput = document.getElementById("user-id-input");
    const skinTypeSelect = document.getElementById("skin-type-select");
    const personalColorSelect = document.getElementById("personal-color-select");
    const skinConcernCheckboxes = document.querySelectorAll("#skin-concern-checkboxes input");
    const userIdSubmitButton = document.getElementById("submit-user-id");
    const registerInfoButton = document.getElementById("register-info-button");
    const userIdDisplay = document.getElementById("user-id-display");
    const productList = document.getElementById("product-list");
    const backButton = document.getElementById("back-button");
    const formContainer = document.getElementById("form-container");
    const userIdContainer = document.getElementById("user-id-container");
    const infoRegistrationContainer = document.getElementById("info-registration-container");
    const infoRegistrationBackButton = document.getElementById("info-registration-back-button");
    const infoRegistrationButtonInitial = document.getElementById("register-info-button-initial");

    // 서버에서 받을 상품 목록 (예제 데이터)
    const recommendedItems = [
        "바이오더마 하이드라비오 토너",
        "브링그린 티트리시카수딩토너",
        "라운드랩 1025 독도 토너",
        "라네즈 크림스킨",
        "토리든 다이브인 저분자 히알루론산 토너",
        "브링그린 티트리시카토너",
        "에스트라 에이시카365 수분진정결토너",
        "넘버즈인 3번 결광가득 에센스 토너",
        "아누아 어성초 77 깐달걀 토너",
        "넘버즈인 1번 진정 맑게담은 청초토너",
        "에스네이처 아쿠아 오아시스 토너",
        "토니모리 원더 세라마이드 모찌 토너",
        "더랩바이블랑두 저분자 히알루론산 딥 토너",
        "웰라쥬 리얼 히알루로닉 100 토너",
        "라운드랩 자작나무 수분 토너",
        "아비브 어성초 카밍 토너 스킨부스터"
    ];

    // 특정 ID로 고정된 추천 결과 생성
    function generateFixedRecommendations(userId) {
        const hash = Array.from(userId).reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const randomSeed = hash % recommendedItems.length;
        return recommendedItems.slice(randomSeed, randomSeed + 3).concat(
            recommendedItems.slice(0, Math.max(0, randomSeed + 3 - recommendedItems.length))
        );
    }

    // 크롬 스토리지에서 userId에 해당하는 user_data를 불러온 후 서버에 보내기
    function fetchRecommendationsFromServer(userId) {
        // 크롬 스토리지에서 userId에 해당하는 user_data를 불러오기
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(userId, (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error("Error reading from Chrome Storage"));
                    return;
                }

                const userData = result[userId];
                if (!userData) {
                    reject(new Error("No user data found for userId: " + userId));
                    return;
                }

                // user_data가 존재하면 서버에 요청
                const { skinType, personalColor, skinConcerns } = userData;

                console.log("Sending request to the server with the following data:", {
                    userId: userId,
                    skinType: skinType,
                    personalColor: personalColor,
                    skinConcerns: skinConcerns
                });

                // 서버에 POST 요청 보내기
                fetch("http://127.0.0.1:8000/recommend_products/", { // 서버 URL로 변경
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    mode: 'cors', // CORS 모드 설정
                    body: JSON.stringify({
                        user_data: {
                            userId: userId,
                            skinType: skinType,
                            personalColor: personalColor,
                            skinConcerns: skinConcerns
                        },
                        category: productCategory,
                        selected_products: []  // 예시로 빈 배열, 실제 선택된 상품을 넣어야 함
                    })
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Error fetching recommendations: ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log(data);
                    if (data.recommended_products) {
                        resolve(data.recommended_products); // 추천 상품 리스트 반환
                    } else {
                        reject(new Error('No recommendations found.'));
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    reject(error);
                });
            });
        });
    }

    // 첫 화면: 사용자 ID 입력 처리
    userIdSubmitButton.addEventListener("click", () => {
        const userId = userIdInput.value.trim();
    
        if (!userId) {
            alert("User ID를 입력하세요!");
            return;
        }
    
        // 카테고리 가져오기
        const categoryElement = document.querySelector(".titBox h1");
        if (!categoryElement) {
            alert("제품 카테고리를 찾을 수 없습니다.");
            return;
        }
        const productCategory = categoryElement.innerText.trim();
        console.log("Product Category:", productCategory);
    
        // 서버로 데이터 전송
        fetchRecommendationsFromServer(userId, productCategory)
            .then(recommendations => {
                console.log("Recommendations received:", recommendations);
    
                chrome.storage.sync.get(userId, (result) => {
                    if (!result[userId]) {
                        console.error("No user data found for update.");
                        return;
                    }
    
                    const updatedData = {
                        ...result[userId],
                        recommendations
                    };
    
                    chrome.storage.sync.set({ [userId]: updatedData }, () => {
                        console.log(`Recommendations updated for ${userId}:`, recommendations);
    
                        // UI 업데이트
                        userIdContainer.style.display = "none";
                        infoRegistrationContainer.style.display = "none";
                        formContainer.style.display = "block";
    
                        userIdDisplay.textContent = `${userId} 님과 비슷한 사용자들은 이런 제품을 추천했어요!`;
                        userIdDisplay.classList.remove("hidden");
    
                        // 추천 아이템 표시
                        productList.innerHTML = '';
                        recommendations.forEach(item => {
                            const li = document.createElement("li");
                            li.textContent = item;
                            productList.appendChild(li);
                        });
                    });
                });
            })
            .catch(error => {
                console.error("Failed to fetch recommendations:", error);
                alert("추천 상품을 불러오는 데 실패했습니다.");
            });
    });

    // '피부 정보 등록' 버튼 클릭 시 처리
    infoRegistrationButtonInitial.addEventListener("click", () => {
        userIdContainer.style.display = "none";
        infoRegistrationContainer.style.display = "block";
    });

    // 피부 정보 등록 처리
    registerInfoButton.addEventListener("click", () => {
        const userId = document.getElementById("register-user-id-input").value.trim();
        const skinType = skinTypeSelect.value;
        const personalColor = personalColorSelect.value;
        const skinConcerns = Array.from(skinConcernCheckboxes)
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.value);

        if (!skinType || !personalColor || skinConcerns.length === 0) {
            alert("모든 항목을 입력/선택하세요!");
            return;
        }

        // 저장할 데이터 객체 생성
        const userData = {
            skinType,
            personalColor,
            skinConcerns,
            recommendations: [] // 고정된 추천 결과 대신 빈 리스트
        };
        console.log(`User data for ${userId} :`, userData);

        // Chrome Storage API로 데이터 저장
        chrome.storage.sync.set({ [userId]: userData }, () => {
            console.log(`User data for ${userId} saved!`);

            // 등록 완료 메시지
            alert(`${userId}의 피부 정보가 정상적으로 등록되었습니다.`);

            // 처음 화면으로 이동
            infoRegistrationContainer.style.display = "none";
            userIdContainer.style.display = "block";
        });
    });

    // 뒤로가기 버튼 처리 (추천 화면 -> 처음 화면)
    backButton.addEventListener("click", () => {
        formContainer.style.display = "none";
        userIdContainer.style.display = "block";
        userIdDisplay.classList.add("hidden");
        footerText.classList.add("hidden");
        productList.innerHTML = '';
    });

    // 뒤로가기 버튼 처리 (피부 정보 등록 화면 -> 처음 화면)
    infoRegistrationBackButton.addEventListener("click", () => {
        infoRegistrationContainer.style.display = "none";
        userIdContainer.style.display = "block";
    });
});
