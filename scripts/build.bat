@echo off
REM build.bat: compila todas as classes a partir do App (rode da raiz do projeto)
javac -encoding UTF-8 -d out -sourcepath src src\br\cesar\vacinas\App.java
