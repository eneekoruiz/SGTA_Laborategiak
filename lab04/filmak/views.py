from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from .models import Filma, Bozkatzailea
from django.core.paginator import Paginator
# Create your views here.

@login_required
def hasiera(request):
    return render(request, 'filmak/hasiera.html')

@login_required
def filmen_zerrenda(request):
    
    filma_guztiak = Filma.objects.all()
    paginator = Paginator(filma_guztiak, 10) 
    
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    return render(request, 'filmak/menua.html', {'page_obj': page_obj})

@login_required
def filma_bozkatu_ikusi(request):
    filma_guztiak = Filma.objects.all()
    if request.method == 'POST':
        filma_id_aukeratua = request.POST.getlist('filma_id')
        filma = get_object_or_404(Filma, id=filma_id_aukeratua[0])
        bozka_perfil, sortu_da = Bozkatzailea.objects.get_or_create(erabiltzailea=request.user)
        if filma in bozka_perfil.gogoko_filmak.all():
            return render(request, 'filmak/bozka.html', {'error': 'Dagoeneko bozkatua duzu pelikula hau', 'filmak': filma_guztiak})
        else:
            bozka_perfil.gogoko_filmak.add(filma)
            filma.bozkak += 1
            filma.save()
            return render(request, 'filmak/bozka.html', {'success': 'Eskerrik asko zure bozkagatik. Bozkatu duzun pelikula: ' + filma.izenburua, 'filmak': filma_guztiak})
    else:
        return render(request, 'filmak/bozka.html', {'filmak': filma_guztiak})
 
@login_required
def bozkatutako_filmak(request):
    if request.method == 'POST':
        pelikula_id = request.POST.getlist('pelikula_id')
        kenduko_dana = get_object_or_404(Filma, id=pelikula_id[0])
        if kenduko_dana.bozkak > 0:
            kenduko_dana.bozkak -= 1
            kenduko_dana.save()
        bozka_perfil = get_object_or_404(Bozkatzailea, erabiltzailea=request.user)
        bozka_perfil.gogoko_filmak.remove(kenduko_dana)
        return redirect('bozkatutako_filmak')
    else:
        try:
            bozkak = request.user.bozkatzailea.gogoko_filmak.all()
        except:
            bozkak = []
        return render(request, 'filmak/bozkatutakoak.html', {'bozkak': bozkak})

@login_required
def filma_zaleak(request):
    filma_guztixak = Filma.objects.all()
    if request.method == 'POST':
        aukeratudouena_id = request.POST.getlist('filma_id')
        aukeratudouena = get_object_or_404(Filma, id=aukeratudouena_id[0])
        erabiltzailiak = Bozkatzailea.objects.filter(gogoko_filmak=aukeratudouena)
        return render(request, 'filmak/zaleak.html', {'zaleak': erabiltzailiak, 'filma': aukeratudouena, 'filmak': filma_guztixak})
    else:
       
        return render(request, 'filmak/zaleak.html', {'filmak': filma_guztixak})


def register(request):
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('login') 
    else:
        form = UserCreationForm()

    return render(request, 'filmak/register.html', {'form': form})