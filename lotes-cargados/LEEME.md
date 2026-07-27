# Lotes ya cargados

Cada archivo de esta carpeta es el registro de un pedido que **ya se escribio en
el catalogo**: que referencia se creo, cual solo sumo stock, y a que producto
quedo enlazada.

El nombre del archivo sale del contenido del excel, asi que subir el mismo
archivo otra vez cae en el mismo registro.

## Para que sirve

Para que volver a cargar un pedido **no duplique el inventario**. Sumar stock no
es repetible: hacerlo dos veces deja el doble de unidades, y de ahi en adelante
los margenes salen mal. Antes de escribir nada, el cargador mira aqui y salta lo
que ya esta.

## Por eso NO se borra

Esta carpeta va en git a proposito. Antes vivia en `.codex_tmp/`, que es
temporal y esta fuera de git: si alguien la limpiaba, el sistema perdia la
memoria de lo cargado y el siguiente intento duplicaba el stock sin avisar.

Si algun dia se pierde un archivo de aqui y hay que volver a cargar ese pedido,
revisar primero en el admin que no este ya cargado.
