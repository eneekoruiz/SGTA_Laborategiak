from django.db import models
from django.contrib.auth.models import User

# Create your models here.
# filmak modeloa srotuko dugu
class Filma(models.Model):
    izenburua = models.CharField(max_length=100)
    zuzendaria = models.CharField(max_length=60)
    urtea = models.IntegerField()
    generoa = models.CharField(max_length=2)
    sinopsia = models.CharField(max_length=500)
    bozkak = models.IntegerField(default=0)
    def __str__(self):
        return self.izenburua
class Bozkatzailea(models.Model):
    erabiltzailea = models.OneToOneField(User, on_delete=models.CASCADE)
    gogoko_filmak = models.ManyToManyField(Filma)
    def __str__(self):
        return self.erabiltzailea.username      