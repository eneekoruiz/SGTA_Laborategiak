from django.urls import path
from . import views

urlpatterns = [
    path("", views.hasiera, name="hasiera"),
    path("zerrenda/", views.filmen_zerrenda, name="filmen_zerrenda"),
    path("bozkatu/", views.filma_bozkatu_ikusi, name="filma_bozkatu_ikusi"),
    path("zaleak/", views.filma_zaleak, name="filma_zaleak"),
    path("register/", views.register, name="register"),
    path("bozkatutakoak/", views.bozkatutako_filmak, name="bozkatutako_filmak"),
]