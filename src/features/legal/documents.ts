import type { Language } from '@/i18n/language';

/**
 * The legal documents, in both languages.
 *
 * They are written on facts VERIFIED in the code, not on a template.
 * What they state was checked before being written:
 *   - there is no analytics or tracking of any kind (no Google Analytics,
 *     no Sentry, no pixels): grep over src/ and index.html;
 *   - document.cookie is not used anywhere;
 *   - the only third party that received requests was Google Fonts, and
 *     that was removed by serving the font from the app itself;
 *   - the data lives in IndexedDB and, if the user creates an account,
 *     also in Supabase (region us-west-2).
 *
 * If any of those things changes, THIS FILE LIES. Anyone adding analytics,
 * a third party or a cookie has to come back here.
 *
 * Honest note: they were written carefully, but they are not legal advice
 * and no lawyer reviewed them.
 */

export const UPDATED = '2026-09-26';

export type LegalSlug = 'aviso' | 'privacidad' | 'terminos' | 'cookies' | 'propiedad';

export const SLUGS: LegalSlug[] = ['aviso', 'privacidad', 'terminos', 'cookies', 'propiedad'];

export interface Block {
  /** Section heading. */
  h?: string;
  /** Parrafos. */
  p?: string[];
  /** Bullet list. */
  ul?: string[];
}

export interface LegalDocument {
  title: string;
  entrada: string;
  bloques: Block[];
}

const ES: Record<LegalSlug, LegalDocument> = {
  aviso: {
    title: 'Aviso legal',
    entrada: 'Quién es responsable de Step up y cómo contactarlo.',
    bloques: [
      {
        h: 'Titular',
        p: [
          'Step up es una aplicación de finanzas personales desarrollada y operada por una persona natural, de forma independiente y sin ánimo de lucro. No es un producto de una entidad financiera ni está vigilada por la Superintendencia Financiera de Colombia.',
          'Contacto: andresarmi11@gmail.com',
        ],
      },
      {
        h: 'Qué es y qué no es Step up',
        p: [
          'Step up es una herramienta para que registres y organices tu propio dinero. Te ayuda a anotar gastos e ingresos, agruparlos por quincena o por mes, seguir los ciclos de tus tarjetas de crédito y ponerte presupuestos.',
        ],
        ul: [
          'No mueve dinero, no hace pagos y no se conecta con tus bancos.',
          'No presta dinero ni intermedia créditos.',
          'No es asesoría financiera, contable ni tributaria. Los números que ves salen de lo que tú registras.',
          'No sustituye tus extractos bancarios. Ante una diferencia, manda el extracto de tu banco.',
        ],
      },
      {
        h: 'Alojamiento',
        p: [
          'La aplicación se sirve como sitio estático desde GitHub Pages (GitHub, Inc.). La sincronización opcional usa Supabase, Inc.',
        ],
      },
      {
        h: 'Disponibilidad',
        p: [
          'Step up se ofrece tal cual está, sin compromiso de disponibilidad continua. Puede dejar de actualizarse o de estar disponible en cualquier momento. Por eso puedes exportar todos tus datos cuando quieras, desde Ajustes, en JSON, CSV o Excel: no quedas encerrado.',
        ],
      },
    ],
  },

  privacidad: {
    title: 'Política de privacidad',
    entrada: 'Qué datos se guardan, dónde, y quién puede verlos.',
    bloques: [
      {
        h: 'Lo corto',
        p: [
          'Step up no tiene analítica, ni rastreadores, ni píxeles publicitarios, ni cookies. No se vende ni se comparte tu información con nadie, porque no hay a quién: el modelo de negocio de esta app no son tus datos.',
          'Tus movimientos viven en tu propio dispositivo. Si creas una cuenta, además se guardan cifrados en tránsito en Supabase para que puedas verlos desde otro teléfono.',
        ],
      },
      {
        h: 'Responsable del tratamiento',
        p: [
          'El titular indicado en el Aviso legal. Contacto para cualquier asunto de datos personales: andresarmi11@gmail.com',
        ],
      },
      {
        h: 'Qué datos se tratan',
        ul: [
          'Sin cuenta: nada sale de tu dispositivo. Todo se guarda en el navegador (IndexedDB).',
          'Con cuenta: tu correo electrónico y una contraseña, que se guarda con hash y nunca en texto plano.',
          'Tus datos financieros: movimientos, conceptos, montos, fechas, categorías, presupuestos, reglas recurrentes y recordatorios.',
          'Tus métodos de pago tal como tú los escribes: un nombre, el día de corte, el día de pago y el cupo. Nunca se pide ni se guarda el número de una tarjeta, su CVV ni su fecha de vencimiento.',
          'Si activas las notificaciones: la suscripción push que genera tu navegador, para poder enviarte el recordatorio.',
        ],
      },
      {
        h: 'Para qué',
        p: [
          'Para prestarte el servicio y nada más: mostrarte tus cuentas, sincronizarlas entre tus dispositivos y avisarte de un pago si tú lo pediste. No se usan para perfilarte, no alimentan publicidad y no se cruzan con otras fuentes.',
        ],
      },
      {
        h: 'Quién los procesa',
        ul: [
          'Supabase, Inc. — base de datos y autenticación, solo si creas cuenta. Servidores en Estados Unidos (región us-west-2).',
          'GitHub, Inc. — alojamiento del sitio. Recibe la petición de descarga de la app, como cualquier servidor web.',
        ],
        p: [
          'No hay más terceros. La tipografía que usa la app se sirve desde la propia aplicación precisamente para que ningún proveedor externo reciba la dirección IP de quien la usa.',
        ],
      },
      {
        h: 'Transferencia internacional',
        p: [
          'Si creas cuenta, tus datos se almacenan en servidores en Estados Unidos. Al registrarte autorizas esa transferencia, en los términos de la Ley 1581 de 2012 y el Decreto 1377 de 2013. Si prefieres que no salgan de tu dispositivo, usa la aplicación sin cuenta: funciona completa.',
        ],
      },
      {
        h: 'Cuánto tiempo',
        p: [
          'Mientras tengas la cuenta. Si la eliminas, se borran sus datos. Lo que esté guardado en tu dispositivo lo controlas tú y puedes borrarlo limpiando los datos del sitio en tu navegador.',
        ],
      },
      {
        h: 'Tus derechos',
        p: [
          'Como titular de tus datos personales puedes conocer, actualizar, rectificar y suprimir tus datos, y revocar la autorización, según la Ley 1581 de 2012. Escribe a andresarmi11@gmail.com y se atiende. También puedes ejercer buena parte de esos derechos sin pedir permiso: editas y borras tus movimientos dentro de la app, y exportas todo desde Ajustes.',
          'Si consideras que no se atendió tu solicitud, puedes presentar una queja ante la Superintendencia de Industria y Comercio.',
        ],
      },
      {
        h: 'Seguridad',
        p: [
          'La comunicación va siempre por HTTPS. Cada cuenta solo puede leer y escribir sus propias filas: eso lo impone la base de datos con reglas a nivel de fila, no solamente la aplicación. Aun así, ningún sistema es infalible y nadie puede prometerte lo contrario.',
        ],
      },
      {
        h: 'Menores de edad',
        p: [
          'Step up no está dirigida a menores de 14 años y no se recogen datos de ellos a sabiendas.',
        ],
      },
    ],
  },

  terminos: {
    title: 'Términos y condiciones',
    entrada: 'Las reglas de uso de la aplicación.',
    bloques: [
      {
        h: 'Aceptación',
        p: [
          'Al usar Step up aceptas estos términos. Si no estás de acuerdo con alguno, lo correcto es no usar la aplicación.',
        ],
      },
      {
        h: 'Qué se te ofrece',
        p: [
          'Una herramienta gratuita para registrar y organizar tu dinero. Puedes usarla sin crear cuenta; en ese caso todo se queda en tu dispositivo. Crear una cuenta solo sirve para que tus datos te sigan a otros dispositivos.',
        ],
      },
      {
        h: 'Tu cuenta',
        ul: [
          'Eres responsable de tu contraseña y de lo que ocurra en tu cuenta.',
          'Debes dar un correo válido: es el único camino para recuperar el acceso.',
          'Puedes dejar de usar la aplicación cuando quieras. Exporta antes tus datos si te importan.',
        ],
      },
      {
        h: 'Uso aceptable',
        p: [
          'No uses Step up para actividades ilícitas, ni intentes acceder a datos de otras personas, ni sobrecargues deliberadamente la infraestructura.',
        ],
      },
      {
        h: 'Los números son tuyos',
        p: [
          'La aplicación calcula sobre lo que tú registras. Si anotas mal un monto o una fecha, el resultado será consistente con ese error. Las proyecciones, los ciclos de tarjeta y los presupuestos son ayudas de organización, no verdades contables ni asesoría financiera. Para decisiones que importen, contrasta con tu banco y, si hace falta, con un profesional.',
        ],
      },
      {
        h: 'Sin garantías y límite de responsabilidad',
        p: [
          'El servicio se presta tal cual está y según disponibilidad, sin garantía de que esté libre de errores o interrupciones. En la máxima medida que permita la ley, no se asume responsabilidad por perjuicios derivados del uso o de la imposibilidad de uso, incluida la pérdida de datos.',
          'Esto no pretende excluir los derechos que la ley colombiana te reconoce como consumidor y que no pueden renunciarse.',
        ],
      },
      {
        h: 'Cambios',
        p: [
          'Estos términos pueden cambiar. La fecha de arriba indica la última versión, y seguir usando la aplicación después de un cambio significa que lo aceptas.',
        ],
      },
      {
        h: 'Ley aplicable',
        p: [
          'Se rigen por la ley colombiana, y cualquier controversia se someterá a los jueces competentes de Colombia.',
        ],
      },
    ],
  },

  cookies: {
    title: 'Política de cookies',
    entrada: 'Spoiler: no hay cookies. Pero sí hay almacenamiento local, y merece explicación.',
    bloques: [
      {
        h: 'Step up no usa cookies',
        p: [
          'Ni propias ni de terceros, ni técnicas ni de análisis ni de publicidad. La aplicación no escribe cookies en ningún momento, y por eso no verás un banner pidiéndote que las aceptes: no habría nada que aceptar.',
        ],
      },
      {
        h: 'Lo que sí se usa, que es distinto',
        p: [
          'La aplicación guarda cosas en tu propio navegador. No son cookies: no viajan en cada petición, no sirven para seguirte entre sitios y nadie más puede leerlas.',
        ],
        ul: [
          'IndexedDB — tus movimientos, categorías, presupuestos y ajustes. Es el corazón de la app: gracias a esto funciona sin conexión.',
          'localStorage — tu sesión si iniciaste sesión, el idioma que elegiste y si cerraste el aviso de instalación.',
          'sessionStorage — una marca temporal que evita un bucle de recargas cuando una actualización falla. Se borra al cerrar la pestaña.',
          'Caché del service worker — una copia de la aplicación para que abra sin red.',
        ],
      },
      {
        h: 'Cómo borrarlo',
        p: [
          'Desde tu navegador, borrando los datos del sitio. En iOS: Ajustes, Safari, Avanzado, Datos de sitios web. Ten en cuenta que si no tienes cuenta, eso borra también tus movimientos: exporta antes desde Ajustes.',
        ],
      },
    ],
  },

  propiedad: {
    title: 'Copyright y propiedad intelectual',
    entrada: 'De quién es el código, de quién es el nombre y de quién son tus datos.',
    bloques: [
      {
        h: 'Tus datos son tuyos',
        p: [
          'Lo primero, porque es lo que más importa: todo lo que registras en Step up te pertenece. No se reclama ningún derecho sobre tus movimientos ni sobre la información que introduces, y puedes llevártela completa cuando quieras desde Ajustes.',
        ],
      },
      {
        h: 'La aplicación',
        p: [
          'El código fuente, el diseño, la interfaz y los textos de Step up están protegidos por derechos de autor de su titular. El repositorio es público en github.com/andressarmi11/step-up y se rige por la licencia que allí figure; si no hay una licencia declarada, se reservan todos los derechos.',
        ],
      },
      {
        h: 'El nombre y el logo',
        p: [
          'El nombre «Step up» y su logotipo identifican la aplicación. Puedes citarlos para referirte a ella; no puedes usarlos de forma que sugiera respaldo, afiliación u origen si no lo hay.',
        ],
      },
      {
        h: 'Lo que es de otros',
        ul: [
          'Instrument Sans, la tipografía, bajo SIL Open Font License 1.1.',
          'Tabler Icons, los iconos, bajo licencia MIT.',
          'Las bibliotecas de código abierto listadas en el repositorio, cada una bajo su propia licencia.',
        ],
        p: [
          'Se agradece el trabajo de quienes las hicieron. Sus licencias se respetan y sus créditos se conservan.',
        ],
      },
      {
        h: 'Si algo tuyo aparece aquí',
        p: [
          'Si crees que algún contenido de la aplicación vulnera tus derechos, escribe a andresarmi11@gmail.com indicando cuál es y por qué. Se revisa y, si procede, se retira.',
        ],
      },
    ],
  },
};

const EN: Record<LegalSlug, LegalDocument> = {
  aviso: {
    title: 'Legal notice',
    entrada: 'Who is behind Step up and how to reach them.',
    bloques: [
      {
        h: 'Who runs this',
        p: [
          'Step up is a personal finance app built and run by an individual, independently and not for profit. It is not a product of a financial institution and it is not supervised by Colombia’s financial regulator.',
          'Contact: andresarmi11@gmail.com',
        ],
      },
      {
        h: 'What Step up is, and what it is not',
        p: [
          'Step up is a tool for recording and organising your own money. It helps you log expenses and income, group them by pay period or month, follow your credit card cycles and set yourself budgets.',
        ],
        ul: [
          'It does not move money, make payments or connect to your banks.',
          'It does not lend money or broker credit.',
          'It is not financial, accounting or tax advice. The numbers you see come from what you enter.',
          'It does not replace your bank statements. If they disagree, your bank is right.',
        ],
      },
      {
        h: 'Hosting',
        p: [
          'The app is served as a static site from GitHub Pages (GitHub, Inc.). Optional sync uses Supabase, Inc.',
        ],
      },
      {
        h: 'Availability',
        p: [
          'Step up is offered as is, with no promise of continuous availability. It may stop being updated or become unavailable at any time. That is why you can export everything whenever you want, from Settings, as JSON, CSV or Excel: you are not locked in.',
        ],
      },
    ],
  },

  privacidad: {
    title: 'Privacy policy',
    entrada: 'What is stored, where it lives, and who can see it.',
    bloques: [
      {
        h: 'The short version',
        p: [
          'Step up has no analytics, no trackers, no advertising pixels and no cookies. Your information is not sold or shared with anyone, because there is no one to share it with: your data is not this app’s business model.',
          'Your transactions live on your own device. If you create an account, they are also stored — encrypted in transit — on Supabase, so you can see them from another phone.',
        ],
      },
      {
        h: 'Data controller',
        p: [
          'The owner named in the Legal notice. For anything about personal data: andresarmi11@gmail.com',
        ],
      },
      {
        h: 'What is processed',
        ul: [
          'Without an account: nothing leaves your device. Everything is stored in your browser (IndexedDB).',
          'With an account: your email address and a password, stored hashed and never in plain text.',
          'Your financial data: transactions, descriptions, amounts, dates, categories, budgets, recurring rules and reminders.',
          'Your payment methods exactly as you type them: a name, the statement cut-off day, the payment day and the credit limit. A card number, CVV or expiry date is never requested or stored.',
          'If you turn on notifications: the push subscription your browser generates, so the reminder can reach you.',
        ],
      },
      {
        h: 'What for',
        p: [
          'To provide the service and nothing else: showing you your accounts, syncing them across your devices and reminding you about a payment if you asked for it. It is not used to profile you, it does not feed advertising and it is not combined with other sources.',
        ],
      },
      {
        h: 'Who processes it',
        ul: [
          'Supabase, Inc. — database and authentication, only if you create an account. Servers in the United States (us-west-2).',
          'GitHub, Inc. — site hosting. It receives the request to download the app, like any web server.',
        ],
        p: [
          'There are no other third parties. The app’s typeface is served from the app itself precisely so that no outside provider receives the IP address of whoever uses it.',
        ],
      },
      {
        h: 'International transfer',
        p: [
          'If you create an account, your data is stored on servers in the United States. By signing up you authorise that transfer under Colombian Law 1581 of 2012 and Decree 1377 of 2013. If you would rather nothing left your device, use the app without an account: it works in full.',
        ],
      },
      {
        h: 'How long',
        p: [
          'For as long as you keep the account. Delete it and its data goes. Whatever is stored on your device is yours to control, and you can remove it by clearing the site data in your browser.',
        ],
      },
      {
        h: 'Your rights',
        p: [
          'You may access, update, correct and delete your personal data, and withdraw your authorisation, under Law 1581 of 2012. Write to andresarmi11@gmail.com and it will be handled. You can also exercise much of this without asking anyone: you edit and delete your transactions inside the app, and export everything from Settings.',
          'If you believe a request was not handled properly, you may complain to Colombia’s Superintendency of Industry and Commerce.',
        ],
      },
      {
        h: 'Security',
        p: [
          'Traffic always goes over HTTPS. Each account can only read and write its own rows, enforced by the database at row level and not only by the app. Even so, no system is infallible and nobody can honestly promise you otherwise.',
        ],
      },
      {
        h: 'Children',
        p: [
          'Step up is not aimed at children under 14 and does not knowingly collect their data.',
        ],
      },
    ],
  },

  terminos: {
    title: 'Terms and conditions',
    entrada: 'The rules for using the app.',
    bloques: [
      {
        h: 'Acceptance',
        p: [
          'By using Step up you accept these terms. If you disagree with any of them, the right thing to do is not to use the app.',
        ],
      },
      {
        h: 'What you get',
        p: [
          'A free tool to record and organise your money. You can use it without an account, in which case everything stays on your device. An account exists only so your data follows you to other devices.',
        ],
      },
      {
        h: 'Your account',
        ul: [
          'You are responsible for your password and for what happens in your account.',
          'You must give a valid email address: it is the only way to recover access.',
          'You can stop using the app whenever you like. Export your data first if it matters to you.',
        ],
      },
      {
        h: 'Acceptable use',
        p: [
          'Do not use Step up for unlawful activity, do not try to reach other people’s data, and do not deliberately overload the infrastructure.',
        ],
      },
      {
        h: 'The numbers are yours',
        p: [
          'The app calculates from what you enter. Record an amount or a date wrongly and the result will be faithfully wrong. Projections, card cycles and budgets are organising aids, not accounting truth and not financial advice. For decisions that matter, check against your bank and, if needed, a professional.',
        ],
      },
      {
        h: 'No warranties, limited liability',
        p: [
          'The service is provided as is and as available, with no warranty that it will be free of errors or interruptions. To the fullest extent the law allows, no liability is accepted for damages arising from use or inability to use, including loss of data.',
          'None of this is intended to exclude the rights Colombian consumer law gives you that cannot be waived.',
        ],
      },
      {
        h: 'Changes',
        p: [
          'These terms may change. The date above marks the latest version, and continuing to use the app after a change means you accept it.',
        ],
      },
      {
        h: 'Governing law',
        p: [
          'Colombian law applies, and any dispute goes to the competent courts of Colombia.',
        ],
      },
    ],
  },

  cookies: {
    title: 'Cookie policy',
    entrada: 'Spoiler: there are none. But there is local storage, and it deserves an explanation.',
    bloques: [
      {
        h: 'Step up uses no cookies',
        p: [
          'None of its own and none from third parties — not technical, not analytical, not advertising. The app never writes a cookie, which is why you will not see a banner asking you to accept them: there would be nothing to accept.',
        ],
      },
      {
        h: 'What it does use, which is different',
        p: [
          'The app stores things in your own browser. These are not cookies: they are not sent with every request, they cannot be used to follow you across sites, and nobody else can read them.',
        ],
        ul: [
          'IndexedDB — your transactions, categories, budgets and settings. This is the heart of the app: it is why it works offline.',
          'localStorage — your session if you signed in, the language you picked, and whether you dismissed the install prompt.',
          'sessionStorage — a temporary marker that prevents a reload loop when an update fails. It disappears when you close the tab.',
          'Service worker cache — a copy of the app so it opens with no network.',
        ],
      },
      {
        h: 'How to clear it',
        p: [
          'From your browser, by clearing the site data. On iOS: Settings, Safari, Advanced, Website Data. Note that without an account this also deletes your transactions — export them first from Settings.',
        ],
      },
    ],
  },

  propiedad: {
    title: 'Copyright and intellectual property',
    entrada: 'Who owns the code, who owns the name, and who owns your data.',
    bloques: [
      {
        h: 'Your data is yours',
        p: [
          'First, because it matters most: everything you record in Step up belongs to you. No rights are claimed over your transactions or the information you enter, and you can take all of it with you at any time from Settings.',
        ],
      },
      {
        h: 'The app',
        p: [
          'The source code, design, interface and copy of Step up are protected by its owner’s copyright. The repository is public at github.com/andressarmi11/step-up and is governed by whatever licence appears there; if no licence is stated, all rights are reserved.',
        ],
      },
      {
        h: 'The name and the logo',
        p: [
          'The name “Step up” and its logo identify the app. You may refer to them when talking about it; you may not use them in a way that suggests endorsement, affiliation or origin where there is none.',
        ],
      },
      {
        h: 'What belongs to others',
        ul: [
          'Instrument Sans, the typeface, under the SIL Open Font License 1.1.',
          'Tabler Icons, the icons, under the MIT licence.',
          'The open source libraries listed in the repository, each under its own licence.',
        ],
        p: [
          'Thanks are due to the people who made them. Their licences are respected and their credits kept.',
        ],
      },
      {
        h: 'If something of yours is here',
        p: [
          'If you believe any content in the app infringes your rights, write to andresarmi11@gmail.com saying what it is and why. It will be reviewed and, if appropriate, removed.',
        ],
      },
    ],
  },
};

export function documentsFor(language: Language): Record<LegalSlug, LegalDocument> {
  return language === 'en' ? EN : ES;
}
