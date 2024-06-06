# Documentation for future use cases

Actualmente, es un poco confuso al momento de trabajar con la librería Baileys. Adjunto las estructuras más utilizadas que encontrarás ante ciertos eventos:

1. Mensaje con sticker

    ```json
    {
      key: {
        remoteJid: '120XXXXXXXXXXXXXXX@g.us', // <- Este es el 'número' del recipiente (un recipiente puede ser un grupo o persona)
        fromMe: true, // <- 'true' si tú mandas el mensaje, 'false' si lo hace otra persona
        id: 'XXXXXXXXXXXXXXXXXXXXXX',
        participant: '{code}{number}@s.whatsapp.net'
      },
      messageTimestamp: 11111111111,
      pushName: '{username}', // <- Este es el nombre de usuario
      broadcast: false, // <- Esto nos indica si es un estado
      status: 2, // <- Este key se añade solo si tú mandas el mensaje
      message: Message {
        stickerMessage: StickerMessage {
          url: 'https://web.whatsapp.net',
          fileSha256: [Uint8Array],
          fileEncSha256: [Uint8Array],
          mediaKey: [Uint8Array],
          mimetype: 'image/webp',
          directPath: '/v/tXX.XXXXX-XX/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.enc?{someValues}',
          fileLength: [Long],
          mediaKeyTimestamp: [Long],
          isAnimated: false, // <- 'true' si el webp es animado, 'false' en caso contrario
          stickerSentTs: [Long]
        }
      }
    }
    ```

2. Mensajes de texto

    ```json
    {
      key: {
        remoteJid: '120XXXXXXXXXXXXXXX@g.us', // <- Este es el 'número' del recipiente (un recipiente puede ser un grupo o persona)
        fromMe: true, // <- 'true' si tú mandas el mensaje, 'false' si lo hace otra persona
        id: 'XXXXXXXXXXXXXXXXXXXXXX',
        participant: '{code}{number}@s.whatsapp.net'
      },
      messageTimestamp: 11111111111,
      pushName: '{username}', // <- Este es el nombre de usuario
      broadcast: false, // <- Esto nos indica si es un estado
      status: 2, // <- Este key se añade solo si tú mandas el mensaje
      message: Message { conversation: '{mensaje del usuario}' }
    }
    ```

3. Mensaje con imagen:

    ```json
    {
      key: {
        remoteJid: '120XXXXXXXXXXXXXXX@g.us',
        fromMe: true,
        id: 'XXXXXXXXXXXXXXXXXXXXXX',
        participant: '{code}{number}@s.whatsapp.net'
      },
      messageTimestamp: 11111111111,
      pushName: '{username}',
      broadcast: false,
      status: 2,
      message: Message {
        imageMessage: ImageMessage {
          interactiveAnnotations: [],
          scanLengths: [],
          url: 'https://mmg.whatsapp.net/o1/v/{long_code}',
          mimetype: 'image/jpeg',
          caption: 'Test with image',
          fileSha256: [Uint8Array],
          fileLength: [Long],
          height: value,
          width: value,
          mediaKey: [Uint8Array],
          fileEncSha256: [Uint8Array],
          directPath: '/v/tXX.XXXXX-XX/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.enc?{someValues}',
          mediaKeyTimestamp: [Long],
          jpegThumbnail: [Uint8Array],
          viewOnce: false
        }
      }
    }
    ```

4. Mensaje con video

```json
{
  key: {
    remoteJid: '120XXXXXXXXXXXXXXX@g.us',
    fromMe: true,
    id: 'XXXXXXXXXXXXXXXXXXXXXX',
    participant: '{code}{number}@s.whatsapp.net'
  },
  messageTimestamp: 11111111111,
  pushName: '{username}',
  broadcast: false,
  status: 2,
  message: Message {
    videoMessage: VideoMessage {
      interactiveAnnotations: [],
      url: 'https://mmg.whatsapp.net/o1/v/{long_code}',
      mimetype: 'video/mp4',
      fileSha256: [Uint8Array],
      fileLength: [Long],
      seconds: {numerical_value},
      mediaKey: [Uint8Array],
      caption: 'Test with video',
      gifPlayback: false,
      height: {numerical_value},
      width: {numerical_value},
      fileEncSha256: [Uint8Array],
      directPath: '/v/tXX.XXXXX-XX/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.enc?{someValues}',
      mediaKeyTimestamp: [Long],
      jpegThumbnail: [Uint8Array],
      streamingSidecar: [Uint8Array],
      viewOnce: false
    }
  }
}
```

5. Mensaje con gif

```json
{
  key: {
    remoteJid: '120XXXXXXXXXXXXXXX@g.us',
    fromMe: true,
    id: 'XXXXXXXXXXXXXXXXXXXXXX',
    participant: '{code}{number}@s.whatsapp.net'
  },
  messageTimestamp: 11111111111,
  pushName: '{username}',
  broadcast: false,
  status: 2,
  message: Message {
    videoMessage: VideoMessage {
      interactiveAnnotations: [],
      url: 'https://mmg.whatsapp.net/o1/v/{long_code}',
      mimetype: 'video/mp4',
      fileSha256: [Uint8Array],
      fileLength: [Long],
      seconds: {numerical_value},
      mediaKey: [Uint8Array],
      caption: 'Test with native gif',
      gifPlayback: true,
      height: {numerical_value},
      width: {numerical_value},
      fileEncSha256: [Uint8Array],
      directPath: '/v/tXX.XXXXX-XX/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.enc?{someValues}',
      mediaKeyTimestamp: [Long],
      jpegThumbnail: [Uint8Array],
      gifAttribution: 2,
      viewOnce: false
    }
  }
}
```

6. Mensaje con enlace y miniatura:

```json
{
  key: {
    remoteJid: '120XXXXXXXXXXXXXXX@g.us',
    fromMe: false,
    id: 'XXXXXXXXXXXXXXXXXXXXXX',
    participant: '{code}{number}@s.whatsapp.net'
  },
  messageTimestamp: 11111111111,
  pushName: '{username}',
  broadcast: false,
  message: Message {
    extendedTextMessage: ExtendedTextMessage {
      text: 'https://XXXXXXXXX.com/XXXXXXXXX/',
      matchedText: 'https://XXXXXXXXX.com/XXXXXXXXX/',
      canonicalUrl: 'https://XXXXXXXXX.com/XXXXXXXXXXXXXXXXXXX?{queries}',
      description: 'XXXXXXXXXXXXXXXXXXXXXX',
      title: 'XXXXXXXXXXXXXX',
      previewType: 0,
      jpegThumbnail: [Uint8Array],
      thumbnailDirectPath: '/v/tXX.XXXXX-XX/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.enc?{someValues}',
      thumbnailSha256: [Uint8Array],
      thumbnailEncSha256: [Uint8Array],
      mediaKey: [Uint8Array],
      mediaKeyTimestamp: [Long],
      thumbnailHeight: {numerical_value},
      thumbnailWidth: {numerical_value},
      inviteLinkGroupTypeV2: 0
    }
  }
}
```

7. Reacción a un mensaje:

    ```json
    {
      key: {
        remoteJid: '120XXXXXXXXXXXXXXX@g.us', // <- Este es el 'número' del recipiente (un recipiente puede ser un grupo o persona)
        fromMe: false, // <- 'true' si tú reaccionas el mensaje, 'false' si lo hace otra persona
        id: 'XXXXXXXXXXXXXXXXXXXXXX',
        participant: '{code}{number}@s.whatsapp.net'
      },
      messageTimestamp: 11111111111,
      pushName: '{username}', // <- Este es el nombre de usuario
      broadcast: false, // <- Esto nos indica si es un estado
      message: Message {
        reactionMessage: ReactionMessage {
          key: [MessageKey],
          text: '{text_message}',
          senderTimestampMs: [Long]
        }
      }
    }
    ```
