bat
@echo off
echo Levantando el sistema SIPRO...
:: Iniciar el Backend en una nueva ventana
start "Backend SIPRO" cmd /k "cd /d C:\PROYECTOS\SIPRO_07\backend && php artisan serve --host=127.0.0.1 --port=8000"
:: Iniciar el Frontend en otra ventana nueva
start "Frontend SIPRO" cmd /k "cd /d C:\PROYECTOS\SIPRO_07\frontend && ng serve -o"
echo El sistema se esta iniciando en ventanas separadas.