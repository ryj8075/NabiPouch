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

    // 첫 화면: 사용자 ID 입력 처리
    userIdSubmitButton.addEventListener("click", () => {
        const userId = userIdInput.value.trim();

        if (!userId) {
            alert("User ID를 입력하세요!");
            return;
        }

        // 저장된 데이터 확인
        chrome.storage.sync.get(userId, (result) => {
            if (result[userId]) {
                // 데이터가 있을 경우 추천 화면으로 이동
                const recommendations = generateFixedRecommendations(userId);

                userIdContainer.style.display = "none";
                infoRegistrationContainer.style.display = "none"; // 이전 화면도 숨김 처리
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

            } else {
                // 데이터가 없을 경우 피부 정보 입력 화면으로 이동
                alert("피부 정보 등록이 되지 않은 ID입니다. 피부 정보 등록을 진행해주세요.");
                userIdContainer.style.display = "none";
                infoRegistrationContainer.style.display = "block";
            }
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

        // 추천 데이터 생성
        const recommendations = generateFixedRecommendations(userId);

        // 저장할 데이터 객체 생성
        const userData = {
            skinType,
            personalColor,
            skinConcerns,
            recommendations // 고정된 추천 결과 저장
        };

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
