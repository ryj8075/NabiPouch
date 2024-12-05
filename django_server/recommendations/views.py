from django.shortcuts import render
from django.http import HttpResponse

# Create your views here.
#def index(request):
#    return HttpResponse("Hello, world. You're at the polls index.")

import numpy as np
import pandas as pd
import os
from django.http import JsonResponse
from rest_framework.views import APIView
from django.conf import settings

from preprocessing import encoding

# 선택된 상품 이름에 해당하는 product_id 찾기
def recommend_products(selected_products, cosmetics):
    selected_product_ids = []
    for name in selected_products:
        for item in cosmetics['product_name']:
            if item in name:
                product_id = cosmetics[cosmetics['product_name'] == item]['product_id'].iloc[0]
                selected_product_ids.append(product_id)
                
    # 중복된 product_id를 제거 (이미 추가된 product_id는 제외)
    selected_product_ids = list(set(selected_product_ids))
    
    return selected_product_ids

# 선택된 product_id에 해당하는 데이터만 저장하기 : users, ratings, cosmetics에 대해 모두 수행해야 함
def product_id_selection(selected_product_ids, df):
    # users, ratings, cosmetics에서 해당 product_id들만 추출
    filtered_df = df[df['product_id'].isin(selected_product_ids)]
    return filtered_df

# 유저 간 유사도 행렬 계산 : Cosine similarity 사용
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# 1. 유저-상품 평점 행렬 생성
def make_ratings_matrix(ratings):
    # 중복 제거 (중복된 행을 제거)
    ratings = ratings.drop_duplicates(subset=['user_id', 'product_id'])

    # 유저 X 아이템 행렬 만들기 : full matrix 변환
    user_item_matrix = ratings.pivot(values='rating', index='user_id', columns='product_id')
    return user_item_matrix

# 2. 유사도 행렬 정렬
def combined_similarity(ratings, users):
    # 사용자 프로파일과 평점 행렬 병합
    # 프로파일 데이터를 평점 행렬에 병합
    users_encoded = encoding.users_profile_mapping(users)
    
    # ratings 데이터와 users_encoded 데이터 병합
    ratings_with_profile = ratings.merge(users_encoded, on='user_id', how='left')

    # 중복 제거
    ratings_with_profile = ratings_with_profile.drop_duplicates(subset=['user_id'])

    # 결측값 처리 (NaN → 0)
    ratings_with_profile.fillna(0, inplace=True)

    # 유저 프로파일 데이터에서 나머지 컬럼들만 사용하여 cosine 유사도 계산
    # 예: skin_type, personal_color 외 다른 컬럼들은 one-hot 인코딩된 정보들
    other_profile_columns = ['sensitiveness', 'trouble', 'atopy', 'dead_skin', 'eyebags', 'pore', 'elasticity', 'wrinkle', 'blemish', 'lightening']

    ratings_with_profile_for_similarity = ratings_with_profile[other_profile_columns]

    # 유저 간 유사도 계산
    user_similarity_with_profile = cosine_similarity(ratings_with_profile_for_similarity)
    user_similarity_with_profile_df = pd.DataFrame(user_similarity_with_profile,
                                               index=ratings_with_profile.index,
                                               columns=ratings_with_profile.index)
    
    # 유저 프로파일 데이터에서 자연어 값들 이용하여 tfidf 유사도 계산
    # NaN 값 처리
    ratings_with_profile['skin_type'] = ratings_with_profile['skin_type'].fillna('정보없음')
    ratings_with_profile['personal_color'] = ratings_with_profile['personal_color'].fillna('정보없음')

    # skin_type과 personal_color 결합
    ratings_with_profile['skin_profile'] = (
        ratings_with_profile['skin_type'].astype(str) + " " + ratings_with_profile['personal_color'].astype(str)
    )

    # 빈 문자열 제거
    ratings_with_profile['skin_profile'] = ratings_with_profile['skin_profile'].str.strip()

    ## TF-IDF 벡터화
    tfidf = TfidfVectorizer()
    tfidf_matrix = tfidf.fit_transform(ratings_with_profile['skin_profile'])

    # TF-IDF 유사도 계산
    cosine_sim_tfidf = cosine_similarity(tfidf_matrix, tfidf_matrix)

    # 유사도를 데이터프레임으로 변환 (user_id 기준)
    cosine_sim_tfidf_df = pd.DataFrame(cosine_sim_tfidf, 
                                   index=ratings_with_profile['user_id'], 
                                   columns=ratings_with_profile['user_id'])
    
    profile_similarity_weight = 0.5
    tfidf_similarity_weight = 0.5

    # 두 유사도 결합
    combined_similarity = (profile_similarity_weight * user_similarity_with_profile_df) + (tfidf_similarity_weight * cosine_sim_tfidf_df)

    combined_similarity = pd.DataFrame(combined_similarity, 
                                    index=ratings_with_profile['user_id'].unique(), 
                                    columns=ratings_with_profile['user_id'].unique())

    return combined_similarity

# 3. 예측 평점 계산 -> 이거 대신 cf_with_profile 쓸듯
def predict_rating_user_based(user_item_matrix, combined_similarity):
    # 유저 유사도와 평점 행렬 곱
    ratings_pred = combined_similarity.dot(user_item_matrix) / np.array([np.abs(combined_similarity).sum(axis=1)]).T
    
    #if wanna make dataframe
    #ratings_pred_df = pd.DataFrame(ratings_pred, index=user_item_matrix.index, columns=user_item_matrix.columns)

    return ratings_pred

# 2번 기능 : 특정 제품에 대한 평점 예측 통해 추천 여부 결정
def cf_with_profile(user_id, product_id, user_similarity, rating_matrix):
    """
    유저 프로필과 협업 필터링 기반의 평점 예측 함수.
    
    Parameters:
        user_id (int): 추천받을 사용자 ID
        product_id (int): 예측하려는 상품 ID
        user_similarity (pd.DataFrame): 유저 간 유사도 행렬
        rating_matrix (pd.DataFrame): 사용자-상품 평점 행렬
        
    Returns:
        float: 예측된 평점
    """
    # 유저별 평점 정보 추출
    similar_users = user_similarity.loc[user_id]
    product_ratings = rating_matrix.loc[:, product_id]
    
    # 유사도가 0이 아닌 유저만 고려
    valid_ratings = product_ratings[product_ratings.notnull()]
    valid_similarities = similar_users.loc[valid_ratings.index]
    
    # 예측 평점 계산
    numerator = np.sum(valid_ratings * valid_similarities)
    denominator = np.sum(np.abs(valid_similarities))
    
    if denominator == 0:
        return 0  # 유사한 사용자가 없으면 0 반환
    
    return numerator / denominator

# 1번 기능 : 특정 카테고리에 대한 추천 제품 리스트 출력
def recommender_with_profile(user_id, user_similarity=None, rating_matrix=None, cosmetics=None, n_items=5):
    """
    사용자 프로필 기반 협업 필터링 추천 함수.
    
    Parameters:
        user_id (int): 추천받을 사용자 ID
        n_items (int): 추천받을 상품 개수
        user_similarity (pd.DataFrame): 유저 간 유사도 행렬
        rating_matrix (pd.DataFrame): 사용자-상품 평점 행렬
        cosmetics (pd.DataFrame): 상품 정보 데이터프레임 (상품명 포함)
        
    Returns:
        pd.Series: 추천 상품의 이름과 평점
    """
    if user_similarity is None or rating_matrix is None or cosmetics is None:
        raise ValueError("user_similarity, rating_matrix, cosmetics는 필수 입력값입니다.")
    
    # 사용자가 이미 평가한 아이템 추출
    rated_items = rating_matrix.loc[user_id][rating_matrix.loc[user_id].notnull()].index
    unrated_items = rating_matrix.loc[user_id].drop(rated_items).index  # 평가되지 않은 상품
    
    # 예측 평점 계산
    predictions = {}
    for product_id in unrated_items:
        predicted_rating = cf_with_profile(user_id, product_id, user_similarity, rating_matrix)
        predictions[product_id] = predicted_rating
    
    # 상위 n_items 추천
    recommendations = pd.Series(data=predictions).sort_values(ascending=False)[:n_items]
    recommended_items = cosmetics.loc[recommendations.index, 'product_name']
    return recommended_items

# RMSE 계산 함수
def RMSE(y_true, y_pred):
    return np.sqrt(np.mean((np.array(y_true) - np.array(y_pred))**2))

# score 함수 정의 : 모델을 입력값으로 받음
# 지금은 x_test 대신 ratings 넣어둠.. 테스트 데이터 넣어서 확인 필요
def score(model, x_test):
    id_pairs = zip(x_test['user_id'], x_test['product_id'])
    y_pred = np.array([model(user, product) for (user, product) in id_pairs])
    y_true = np.array(x_test['rating'])
    return RMSE(y_true, y_pred)


class RecommendProducts(APIView):
    def post(self, request):
        print("Request data:", request.data)  # debugging

        # 사용자 데이터 등록
        user_data = request.data.get('user_data')  # 사용자 데이터는 JSON 객체로 전달됨
        if not user_data:
            return JsonResponse({"error": "사용자 데이터가 비어 있습니다."}, status=400)

        user_id = user_data.get('userId')
        skin_type = user_data.get('skinType')
        personal_color = user_data.get('personalColor')
        skin_concerns = user_data.get('skinConcerns', [])  # 피부 고민 목록

        print(f"Received user data: {user_data}")  # 사용자 데이터 확인

        if not user_id or not skin_type or not personal_color or not skin_concerns:
            return JsonResponse({"error": "사용자 데이터의 필수 항목이 누락되었습니다."}, status=400)

        # 클라이언트로부터 카테고리 텍스트를 받기
        category = request.data.get('category')
        if not category:
            return JsonResponse({"error": "카테고리가 제공되지 않았습니다."}, status=400)
        
        '''
        # 클라이언트에서 전달받은 상품 이름 목록
        selected_products = request.data.get('selected_products', [])
        
        if not selected_products:
            return JsonResponse({"error": "상품 목록이 비어 있습니다."}, status=400)
        '''
            
        # CSV 파일 경로
        USER_CSV_PATH = os.path.join(settings.BASE_DIR, "data/all_users.csv")
        COSMETICS_CSV_PATH = os.path.join(settings.BASE_DIR, "data/final_items.csv")
        RATINGS_CSV_PATH = os.path.join(settings.BASE_DIR, "data/final_ratings.csv")

        # 데이터 로드
        users = pd.read_csv(USER_CSV_PATH)
        cosmetics = pd.read_csv(COSMETICS_CSV_PATH)
        ratings = pd.read_csv(RATINGS_CSV_PATH)

        # 카테고리로 필터링 (product_type 컬럼을 기준으로)
        filtered_ratings = ratings[ratings['product_type'] == category]
        filtered_cosmetics = cosmetics[cosmetics['product_type'] == category]

        '''
        # 현재 페이지에 있는 상품들만 모으는 데이터 필터링
        selected_product_ids = recommend_products(selected_products)
        filtered_users = selected_product_ids(selected_product_ids, users)
        filtered_ratings = selected_product_ids(selected_product_ids, ratings)
        filtered_cosmetics = selected_product_ids(selected_product_ids, cosmetics)
        '''
        
        # 사용자 데이터를 데이터프레임에 추가
        new_user_row = {
            'user_id': user_id,
            'skin_type': skin_type,
            'personal_color': personal_color,
            'sensitiveness': 1 if 'sensitiveness' in skin_concerns else 0,
            'non_inflammatory_acne': 1 if 'non_inflammatory_acne' in skin_concerns else 0,
            'trouble': 1 if 'trouble' in skin_concerns else 0,
            'atopy': 1 if 'atopy' in skin_concerns else 0,
            'dead_skin': 1 if 'dead_skin' in skin_concerns else 0,
            'eyebags': 1 if 'eyebags' in skin_concerns else 0,
            'pore': 1 if 'pore' in skin_concerns else 0,
            'elasticity': 1 if 'elasticity' in skin_concerns else 0,
            'wrinkle': 1 if 'wrinkle' in skin_concerns else 0,
            'blemish': 1 if 'blemish' in skin_concerns else 0,
            'lightening': 1 if 'lightening' in skin_concerns else 0,
        }
        users = pd.concat([users, pd.DataFrame([new_user_row])], ignore_index=True)

        # Ratings 데이터프레임에 새로운 유저 행 추가 (초기값 설정)
        new_rating_row = {
            'user_id': user_id,
            'product_id': 0,  # 새 유저이므로 초기값으로 0
            'product_type': '',  # 새 유저이므로 초기값으로 빈 문자열
            'review': '',     # 새 유저이므로 초기값으로 빈 문자열
            'rating': 0       # 새 유저이므로 초기값으로 0
        }
        filtered_ratings = pd.concat([filtered_ratings, pd.DataFrame([new_rating_row])], ignore_index=True)

        # 협업필터링 알고리즘
        user_item_matrix = make_ratings_matrix(filtered_ratings)
        user_similarity_with_profile = combined_similarity(filtered_ratings, users)
        recommended = recommender_with_profile(user_id, user_similarity_with_profile, user_item_matrix, filtered_cosmetics, n_items=3)
        
        print("Recommended products:", recommended)  # debugging

        # 추천 결과 반환
        return JsonResponse({"recommended_products": recommended}, status=200)