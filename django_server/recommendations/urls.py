from django.urls import path

from . import views
from .views import RecommendProducts

urlpatterns = [
    path('recommend/', RecommendProducts.as_view(), name='product-recommend'),
]