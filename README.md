# SumiBot

<img src="https://media.tenor.com/__6p7Vg6SXYAAAAd/momo-made-in-japan.gif" height="250"/>

<br>

SumiBot es un bot de WhatsApp desarrollado utilizando la biblioteca @adiwajshing/baileys. Proporciona varias funcionalidades y comandos para interactuar con usuarios en WhatsApp. Este proyecto es una reescritura del [WhatsAppBot](https://github.com/totallynotdavid/WhatsAppBot) original con el objetivo de mejorar su rendimiento.

## Instalación

1. **Clonar el repositorio**:

    ```bash
    git clone https://github.com/tu-nombre-de-usuario/SumiBot.git
    ```

2. **Instalar las dependencias**:

    ```bash
    npm i
    ```

3. **Configurar las variables de entorno**: Crea un archivo .env en el directorio raíz del proyecto y agrega las siguientes variables:

    ```bash
    OWNER_ID=<tu-id-de-propietario>
    WEATHERSTACK_API_KEY=<tu-clave-de-api-weatherstack>
    ```

    Nota: Reemplaza <tu-id-de-propietario> con tu propio número de WhatsApp. El formato es `{códigoDePaís}{número}`.

4. **Ejecutar el bot**: 

    ```bash
    node index.js
    ```

## Uso

Una vez que el bot esté en funcionamiento, estará a la escucha de los mensajes entrantes en WhatsApp. El bot admite los siguientes comandos:

- `!translate <texto>` - Traduce el texto dado al inglés.
- `!weather <ubicación>` - Obtiene la información meteorológica para la ubicación especificada.
- `!reply` - Responde al remitente con un mensaje de saludo.
- `!mention` - Menciona al propietario del bot en un mensaje.
- `!location` - Envía una ubicación predefinida.
- `!contact` - Envía una tarjeta de contacto con la información del propietario del bot.
- `!template` - Envía un mensaje con una plantilla que contiene botones.
- `!links` - Envía un mensaje con un enlace.
- `!mp3` - Envía un mensaje de audio.

## Personalización

Para ampliar la funcionalidad del bot o agregar nuevos comandos, puedes modificar el archivo commands.js. Los comandos existentes demuestran cómo manejar diferentes tipos de mensajes y enviar respuestas adecuadas. Puedes agregar tus propios comandos o modificar los existentes según tus necesidades.

## Licencia

Este proyecto está bajo la Licencia MIT.
