/**
 * Textos de la interfaz, en los dos idiomas.
 *
 * Un objeto plano y no una libreria de i18n: la app tiene dos idiomas y no
 * necesita pluralizacion por reglas CLDR, interpolacion compleja ni carga
 * diferida por locale. Una dependencia aqui seria peso sin ganancia.
 *
 * El español es la referencia: si una clave falta en ingles, se cae a ella
 * (ver idioma.tsx). Es preferible una palabra en español suelta a un
 * "missing.translation.key" en pantalla.
 *
 * Lo que NO se traduce, y por que:
 *  - El dictado y el interprete de texto (domain/nlp) entienden español:
 *    "gasté 45 mil en el almuerzo". Traducir la interfaz no los vuelve
 *    bilingues, asi que la pantalla avisa en vez de mentir.
 *  - Los nombres de las categorias y de las tarjetas son datos del
 *    usuario, no de la app.
 */
export const TEXTOS = {
  es: {
    // Navegacion
    'nav.inicio': 'Inicio',
    'nav.movimientos': 'Movimientos',
    'nav.calendario': 'Calendario',
    'nav.analisis': 'Análisis',
    'nav.ajustes': 'Ajustes',
    'nav.volver': 'Volver',
    'nav.volverAjustes': 'Volver a ajustes',
    'nav.mesAnterior': 'Mes anterior',
    'nav.mesSiguiente': 'Mes siguiente',
    'nav.hoy': 'Hoy',
    'nav.volverMesActual': 'Volver al mes actual',

    // Pantallas
    'inicio.titulo': 'Inicio',
    'inicio.hola': 'Hola',
    'inicio.teQueda': 'Te queda este mes',
    'inicio.explicacion': 'Ingresos menos gastos del mes, contando lo pagado y lo que falta.',
    'inicio.yaRecibiste': 'Ya recibiste',
    'inicio.faltaRecibir': 'Falta recibir',
    'inicio.yaPagaste': 'Ya pagaste',
    'inicio.faltaPagar': 'Falta pagar',
    'movimientos.titulo': 'Movimientos',
    'movimientos.buscar': 'Buscar en todo el historial…',
    'movimientos.vacio': 'Mes vacío',
    'calendario.titulo': 'Calendario',
    'calendario.subtitulo': 'Gastos, ingresos y pagos de TC',
    'analisis.titulo': 'Análisis',
    'ajustes.titulo': 'Ajustes',
    'presupuestos.titulo': 'Presupuestos',
    'presupuestos.subtitulo': 'Solo informan, nunca bloquean',
    'presupuestos.definir': 'Definir presupuesto',
    'presupuestos.gastado': 'gastado',
    'presupuestos.teQuedan': 'Te quedan',
    'presupuestos.tePasaste': 'Te pasaste por',
    'tarjetas.titulo': 'Tarjetas',
    'tarjetas.subtitulo': 'Cada compra, y el total por ciclo',
    'metodos.titulo': 'Métodos de pago',
    'categorias.titulo': 'Categorías',

    // Filtros
    'filtro.todos': 'Todos',
    'filtro.gastos': 'Gastos',
    'filtro.ingresos': 'Ingresos',
    'filtro.pendientes': 'Pendientes',
    'filtro.pagados': 'Pagados',
    'rango.quincena': 'quincena',
    'rango.mes': 'mes',
    'rango.trimestre': 'trimestre',
    'rango.anio': 'año',

    // Acciones
    'accion.guardar': 'Guardar',
    'accion.cancelar': 'Cancelar',
    'accion.eliminar': 'Eliminar',
    'accion.seleccionar': 'Seleccionar',
    'accion.reintentar': 'Reintentar',

    // Estados
    'estado.pagado': 'Pagado',
    'estado.pendiente': 'Pendiente',
    'estado.programado': 'Programado',
    'estado.cancelado': 'Cancelado',

    // Ajustes: idioma y legal
    'ajustes.idioma': 'Idioma',
    'ajustes.idiomaNota': 'Solo cambia la interfaz. Tu moneda y tus montos no se tocan.',
    'ajustes.legal': 'Legal',
    'ajustes.tusDatos': 'Tus datos',
    'legal.titulo': 'Legal',
    'legal.subtitulo': 'Qué hacemos con tus datos, y qué no',
    'legal.aviso': 'Aviso legal',
    'legal.privacidad': 'Política de privacidad',
    'legal.terminos': 'Términos y condiciones',
    'legal.cookies': 'Política de cookies',
    'legal.propiedad': 'Copyright y propiedad intelectual',
    'legal.actualizado': 'Última actualización',
    'legal.noEncontrado': 'Ese documento no existe. Vuelve a Legal para ver los que sí.',

    // Dictado
    'dictado.soloEspanol': 'El dictado entiende español. Puedes escribir el movimiento a mano en cualquier idioma.',
  },

  en: {
    'nav.inicio': 'Home',
    'nav.movimientos': 'Transactions',
    'nav.calendario': 'Calendar',
    'nav.analisis': 'Insights',
    'nav.ajustes': 'Settings',
    'nav.volver': 'Back',
    'nav.volverAjustes': 'Back to settings',
    'nav.mesAnterior': 'Previous month',
    'nav.mesSiguiente': 'Next month',
    'nav.hoy': 'Today',
    'nav.volverMesActual': 'Back to the current month',

    'inicio.titulo': 'Home',
    'inicio.hola': 'Hi',
    'inicio.teQueda': 'Left this month',
    'inicio.explicacion': 'Income minus expenses for the month, counting what is paid and what is not.',
    'inicio.yaRecibiste': 'Received',
    'inicio.faltaRecibir': 'Still coming',
    'inicio.yaPagaste': 'Paid',
    'inicio.faltaPagar': 'Still to pay',
    'movimientos.titulo': 'Transactions',
    'movimientos.buscar': 'Search your whole history…',
    'movimientos.vacio': 'Nothing this month',
    'calendario.titulo': 'Calendar',
    'calendario.subtitulo': 'Expenses, income and card payments',
    'analisis.titulo': 'Insights',
    'ajustes.titulo': 'Settings',
    'presupuestos.titulo': 'Budgets',
    'presupuestos.subtitulo': 'They inform you, they never block you',
    'presupuestos.definir': 'Set a budget',
    'presupuestos.gastado': 'spent',
    'presupuestos.teQuedan': 'You have',
    'presupuestos.tePasaste': 'Over by',
    'tarjetas.titulo': 'Cards',
    'tarjetas.subtitulo': 'Every purchase, and each cycle total',
    'metodos.titulo': 'Payment methods',
    'categorias.titulo': 'Categories',

    'filtro.todos': 'All',
    'filtro.gastos': 'Expenses',
    'filtro.ingresos': 'Income',
    'filtro.pendientes': 'Unpaid',
    'filtro.pagados': 'Paid',
    'rango.quincena': 'pay period',
    'rango.mes': 'month',
    'rango.trimestre': 'quarter',
    'rango.anio': 'year',

    'accion.guardar': 'Save',
    'accion.cancelar': 'Cancel',
    'accion.eliminar': 'Delete',
    'accion.seleccionar': 'Select',
    'accion.reintentar': 'Try again',

    'estado.pagado': 'Paid',
    'estado.pendiente': 'Unpaid',
    'estado.programado': 'Scheduled',
    'estado.cancelado': 'Cancelled',

    'ajustes.idioma': 'Language',
    'ajustes.idiomaNota': 'Changes the interface only. Your currency and amounts stay as they are.',
    'ajustes.legal': 'Legal',
    'ajustes.tusDatos': 'Your data',
    'legal.titulo': 'Legal',
    'legal.subtitulo': 'What we do with your data, and what we do not',
    'legal.aviso': 'Legal notice',
    'legal.privacidad': 'Privacy policy',
    'legal.terminos': 'Terms and conditions',
    'legal.cookies': 'Cookie policy',
    'legal.propiedad': 'Copyright and intellectual property',
    'legal.actualizado': 'Last updated',
    'legal.noEncontrado': 'That document does not exist. Go back to Legal to see the ones that do.',

    'dictado.soloEspanol': 'Voice entry understands Spanish. You can always type a transaction in any language.',
  },
} as const;

export type ClaveTexto = keyof typeof TEXTOS.es;
