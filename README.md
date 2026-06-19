# SGTA Laborategiak

Coleccion de practicas de Sistemas de Gestion y Tecnologias Avanzadas. El repositorio conserva ejercicios independientes y un trabajo practico de mayor alcance, por lo que cada carpeta tiene sus propios requisitos.

## Contenido

- `Lab01`, `Lab02`, `Lab3` y `lab04`: ejercicios de laboratorio desarrollados con .NET.
- `Lan_praktikoa`: SimHiri, una aplicacion de simulacion urbana con frontend, API en Python y un servicio separado para funciones asistidas por IA.

La documentacion especifica de SimHiri se encuentra en [`Lan_praktikoa/README.md`](Lan_praktikoa/README.md). Los laboratorios se abren desde sus archivos de solucion o proyecto correspondientes.

## Arquitectura

Los laboratorios .NET son proyectos independientes y no comparten una capa de ejecucion comun. `Lan_praktikoa` si se divide en un frontend Svelte, una API Python y un servicio separado para las funciones asistidas por IA.

La API concentra la simulacion y la autenticacion. El frontend consume esa API para presentar el estado de la ciudad, y las funciones generativas se delegan al servicio de IA cuando esta disponible.

## Documentacion

La [documentacion en DeepWiki](https://deepwiki.com/eneekoruiz/SGTA_Laborategiak) permite explorar de forma adicional la estructura de los laboratorios y del trabajo practico.
