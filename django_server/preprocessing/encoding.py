import numpy as np
import pandas as pd

def users_profile_mapping(users):
    # 사용자 프로파일을 숫자로 변환
    users_encoded = users.copy()
    
    # 피부 고민 인코딩
    problems = ['sensitiveness', 'non_inflammatory_acne', 'trouble', 'atopy', 'dead_skin', 'eyebags', 'pore', 'elasticity', 'wrinkle', 'blemish', 'lightening']
    for problem in problems:
        users_encoded[problem] = users_encoded[problem].map({np.nan: 0, 'O': 1})  # 민감도 인코딩

    # skin_type, personal_color 결측치 채우기
    users_encoded = users_encoded.fillna('정보없음')

    return users_encoded