# OtroCAD Android — prototipo inicial

Este proyecto inicia una envoltura Android con WebView para el editor web de OtroCAD. Requiere conexión y aún no es una aplicación CAD nativa completa. Es código de partida, no un APK probado.

Pendiente antes de entregar un APK utilizable: implementar guardado/descargas de archivos y PDF, tratamiento correcto de archivos compartidos, gestión de impresión y ventanas, respaldo de dibujos, soporte sin conexión y pruebas en dispositivos Android. También falta compilar y firmar el paquete. Abrir desde la aplicación usa el selector de Android; no se ha verificado en dispositivo.

Para desarrollo se requieren JDK 17, Gradle compatible con Android Gradle Plugin 8.7.3, Android SDK 35 y acceso a los repositorios de Google y Maven Central. Abrir `android/` en Android Studio y crear una compilación debug para pruebas; no distribuirla como versión final.
