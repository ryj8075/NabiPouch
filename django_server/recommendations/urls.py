from django.urls import path

from . import views
from .views import RecommendProducts

urlpatterns = [
    path('recommend_products/', RecommendProducts.as_view(), name='recommend_products'),
]