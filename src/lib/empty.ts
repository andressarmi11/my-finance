/**
 * Un arreglo vacio COMPARTIDO, para el `?? []` de useLiveQuery.
 *
 * `useLiveQuery(...) ?? VACIO` parece inofensivo, pero crea un arreglo nuevo
 * en cada render mientras Dexie no haya resuelto. Ese arreglo entra como
 * dependencia de los useMemo de abajo, asi que su identidad cambia sola y
 * los memos se recalculan sin que nada haya cambiado. Con una constante
 * compartida la identidad es estable y el memo hace lo que promete.
 */
export const VACIO: never[] = [];
