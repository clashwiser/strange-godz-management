// Mas cerebro para los dos bots: lo que se pregunta en un clan de Clash.
//
// Las primeras versiones cubrian lo social -saludos, chistes, animo- y
// poco del juego. Pero en un grupo de Clash la gente pregunta por heroes,
// por el TH, por muros, por la capital, por el pase, por el lag, por si
// una cuenta es comprada, por donde esta su tag. Aqui van esas
// categorias, con la voz de cada uno:
//
//   Heraldo    asere, mi hermano, socio, compadre
//   Valquiria  mi cielo, mi vida, mi corazon, cariño
//
// El mismo patron sirve para los dos porque la pregunta es la misma; lo
// que cambia es quien la contesta. Cada categoria lleva las dos listas.
//
// Lo que NO hay aqui: datos. Ninguna frase dice cuantas estrellas tiene
// nadie ni quien falta por atacar. Eso lo saben los comandos, y una frase
// que suene a dato y no lo sea es peor que callarse.

const par = (nombre, patron, heraldo, valquiria) => ({ nombre, patron, heraldo, valquiria });

export const MAS = [
  // ---------------------------------------------------------------- juego
  par(
    'heroes',
    /\b(rey barbaro|reina arquera|gran centinela|campeona real|principe esbirro|mis heroes|los heroes|heroe|heroes|subir al rey|subir la reina|mejorar heroes|heroes dormidos|heroe durmiendo|mi rey|el rey|mi reina|la reina|el centinela|la campeona|el principe)\b/,
    [
      'Sin héroes no se ataca en guerra, asere. Si están durmiendo, avisa antes de la ronda, no después.',
      'Sube primero a la Reina, mi hermano. Es la que más ataques salva.',
      'Un héroe dormido en día de guerra es un ataque tirado. Planifica las mejoras para que caigan entre guerras.',
      'El Gran Centinela es como el buen compadre: no pega mucho, pero te salva la vida.',
      'Al Rey le gusta el altar, socio. Sácalo de ahí un rato, que no muerde.',
      'Héroes al máximo y ejército mediocre gana más que ejército perfecto y héroes en el hospital.',
      'Los libros de héroe se guardan para la guerra, no para el día que te aburres.',
      'Campeona Real bien llevada vale por dos hechizos. Aprende a tirarla.',
    ],
    [
      'Sin héroes no hay guerra, mi cielo. Si los tienes durmiendo, dilo antes de que salga la alineación.',
      'La Reina primero, mi vida. Es la que más ataques salva, y lo dice una que elige guerreros.',
      'Un héroe dormido el día de guerra es un ataque regalado, cariño. Planifica.',
      'El Gran Centinela es el amigo que no pega pero te cubre, mi corazón. Cuídalo.',
      'A tu Rey lo quiero fuera del altar, mi cielo. Ahí no gana nada.',
      'Yo miro los héroes antes que las estrellas, mi vida. Dicen más de cómo cuidas tu cuenta.',
      'Los libros de héroe son para la guerra, cariño. No para un martes cualquiera.',
      'Una Campeona bien tirada vale por dos hechizos, mi corazón. Practícala en amistosa.',
    ]
  ),
  par(
    'mascotas',
    /\b(mascota|mascotas|lassi|electro buho|buho|yak|unicornio|zorro helado|fenix|fénix|pets?)\b/,
    [
      'Las mascotas son el postre, asere: primero el plato fuerte, que son los héroes.',
      'El búho eléctrico con el Centinela es la combinación que más ataques salva. Pruébala.',
      'No pongas mascota por poner: cada una tiene su héroe. Lee la descripción, que es gratis.',
      'La mascota se sube cuando los héroes ya no piden más. Antes es lujo.',
      'El yak tumba muros que ni el Rey tumba. Para bases cerradas, oro puro.',
    ],
    [
      'Las mascotas son el postre, mi cielo: primero los héroes, que son el plato fuerte.',
      'El búho con el Centinela salva ataques, mi vida. Pruébalo en una amistosa.',
      'Cada mascota tiene su héroe, cariño. Ponerla por poner es tirar elixir oscuro.',
      'Cuando los héroes ya no pidan más, entonces las mascotas, mi corazón. Ese es el orden.',
      'El yak abre muros que ni el Rey abre, mi cielo. Para bases cerradas, es mi favorito.',
    ]
  ),
  par(
    'equipamiento',
    /\b(equipamiento|equipo del heroe|equipamientos|forja|mineral|minerales|ore|equipment)\b/,
    [
      'El equipamiento se mejora con mineral, y el mineral sale de la guerra. Otra razón para atacar, socio.',
      'No lo repartas entre todos: elige dos equipamientos buenos por héroe y súbelos a tope.',
      'La guerra da mineral aunque pierdas. Aunque pierdas, asere. Ataca.',
      'Un equipamiento épico a medias vale menos que uno común al máximo. Termina lo que empiezas.',
      'Cada dos semanas cambian los que vende el Comerciante. Guarda gemas para el que te sirva.',
    ],
    [
      'El equipamiento se paga con mineral, y el mineral se gana en guerra, mi cielo. Otra razón para atacar.',
      'Dos piezas buenas por héroe, mi vida. Repartir el mineral entre todo es no subir nada.',
      'Aunque pierdas la guerra hay mineral, cariño. Aunque pierdas. Ataca.',
      'Un equipamiento a medias no sirve, mi corazón. Termina uno antes de empezar otro.',
      'Guarda gemas para el que te sirva de verdad, mi cielo, no para el que brilla más.',
    ]
  ),
  par(
    'ayuntamiento',
    /\b(subo de th|subir de th|subir el th|subir el ayuntamiento|ayuntamiento|rushed|rush|rusheado|maxear|maxeado|maxeo|estoy max|th nuevo|cuando subo)\b/,
    [
      'Sube de TH cuando los héroes y las defensas clave estén al máximo, asere. No cuando te aburras.',
      'Rushear no es pecado si sabes lo que haces. Lo que es pecado es rushear y no donar.',
      'Un TH alto con tropas bajas es un peso muerto en guerra: te dan 3 y tú das 1.',
      'Maxear todo tampoco: los muros no ganan guerras. Prioriza ofensiva.',
      'Antes de subir, pregunta en el grupo. Aquí hay gente que ya pasó por ese TH y se sabe los errores.',
      'El laboratorio nunca para, mi hermano. Si está vacío, algo hiciste mal.',
      'Si estás rushed, la salida es simple: héroes, laboratorio, campamentos. Lo demás espera.',
      'Un TH nuevo no te hace mejor, socio. Te hace un objetivo más grande.',
    ],
    [
      'Sube de TH cuando los héroes estén listos, mi cielo. No cuando te aburras del actual.',
      'Rushear no es pecado, mi vida. Rushear y no donar, sí.',
      'Un TH alto con tropas bajas regala estrellas en guerra, cariño. A mí no me engaña el número del TH.',
      'Los muros no ganan guerras, mi corazón. Primero lo que ataca.',
      'Pregunta antes de subir, mi cielo. Aquí hay gente que ya se comió ese error.',
      'Laboratorio parado es tiempo perdido, mi vida. Siempre algo mejorando.',
      'Si estás rushed: héroes, laboratorio, campamentos, cariño. En ese orden y sin llorar.',
      'El TH nuevo no te hace mejor, mi corazón. Te hace un blanco más grande.',
    ]
  ),
  par(
    'capital',
    /\b(capital|raid|raids|asalto|asaltos|fin de semana de asalto|oro de capital|medallas de asalto|distrito|distritos)\b/,
    [
      'Los asaltos de fin de semana son seis ataques gratis, asere. Gratis. Úsalos.',
      'Las medallas de asalto compran refuerzos para el castillo. El que no ataca en el asalto, no se queje después.',
      'En la capital se ataca hasta acabar el distrito, no hasta que te canses.',
      'El oro de la capital se dona en la capital. No te lo lleves en el bolsillo.',
      'Seis ataques, viernes a lunes. Si se te pasan, se te pasaron: no hay repesca.',
      'Un asalto bien hecho da más medallas que una semana de farmeo. Cuentas claras.',
    ],
    [
      'Seis ataques gratis cada fin de semana, mi cielo. Los que no los usan me duelen.',
      'Las medallas de asalto son refuerzos para el castillo, mi vida. Se ganan atacando el fin de semana.',
      'En la capital se termina el distrito, cariño. No se deja a medias.',
      'El oro de capital se pone en la capital, mi corazón. Ahí no hay bolsillo.',
      'De viernes a lunes, mi cielo. Si se te pasa, se te pasó.',
      'Un asalto completo da más que una semana de farmeo, mi vida. Y toma diez minutos.',
    ]
  ),
  par(
    'juegos del clan',
    /\b(juegos del clan|clan games|los juegos|retos del clan|puntos de los juegos|tarea del clan|tareas del clan)\b/,
    [
      'Los juegos del clan son puntos por hacer lo que ya haces, asere. Elige la tarea y dale.',
      'Cuatro mil puntos por cabeza y el clan llega al tope. No hace falta ser héroe, hace falta aparecer.',
      'Las recompensas de los juegos son libros y pociones. Eso son héroes más rápido. Participa.',
      'Si una tarea te sale imposible, cámbiala. Cuesta tiempo, pero menos que no hacerla.',
      'El que hace cero en los juegos y después pide libro, me lo apunto. 😄',
    ],
    [
      'Los juegos del clan son puntos por jugar, mi cielo. Elige tarea y dale.',
      'Con cuatro mil por cabeza llegamos al tope, mi vida. No pido héroes, pido presencia.',
      'Los libros salen de los juegos, cariño. El que quiera héroes rápido, ya sabe.',
      'Tarea imposible se cambia, mi corazón. Tarea sin hacer se nota.',
      'Cero en los juegos y después pidiendo libro, mi cielo. Me lo apunto. 😉',
    ]
  ),
  par(
    'pase',
    /\b(pase de oro|pase dorado|gold pass|el pase|pase de temporada|comprar el pase|vale la pena el pase)\b/,
    [
      'El pase de oro es lo único que vale la pena pagar en este juego, asere. Y aun así, tú decides.',
      'Con el pase mejoras más rápido y ganas un libro al mes. Sin pase también se llega, solo tarda más.',
      'El pase no te hace mejor atacante. Te hace subir más rápido. Son cosas distintas.',
      'Si lo compras, aprovéchalo: las tareas del pase también dan puntos. No lo dejes a medias.',
      'Gratis o con pase, la guerra es la misma. Lo que cambia es la paciencia.',
    ],
    [
      'El pase es lo único que vale la pena pagar aquí, mi cielo. Pero eso lo decides tú, no yo.',
      'Con pase subes más rápido, mi vida. Sin pase también llegas, solo con más paciencia.',
      'El pase no ataca por ti, cariño. Eso sigue siendo cosa tuya.',
      'Si lo compras, termínalo, mi corazón. Un pase a medias es dinero tirado.',
      'Gratis o pagando, la guerra es igual de guerra, mi cielo.',
    ]
  ),
  par(
    'trofeos',
    /\b(trofeos|copas|liga de trofeos|legend|leyenda|leyendas|titan|campeon|campeón|subir copas|bajar copas|pushear|push)\b/,
    [
      'Los trofeos son bonitos, asere, pero la guerra es lo que importa aquí. Que no te distraigan.',
      'Legend es para los que atacan ocho veces al día. Si tienes el tiempo, adelante; si no, no te frustres.',
      'Para subir copas: ataca bases más flojas que la tuya y defiende con una base que no sea la de guerra.',
      'Bajar copas para farmear es legal, socio. Bajar copas por vago, no.',
      'En Titán y Leyenda te atacan los mejores. Es la mejor escuela que hay, y es gratis.',
      'Trofeos altos con cero estrellas de guerra me dicen algo, mi hermano. Y no es bueno.',
    ],
    [
      'Los trofeos son bonitos, mi cielo. Pero yo elijo por la guerra, no por las copas.',
      'Leyenda es para quien ataca ocho veces al día, mi vida. Si tienes el tiempo, adelante.',
      'Para subir copas ataca bases más flojas, cariño, y defiende con una base seria.',
      'Bajar copas para farmear es legal, mi corazón. Bajar por vago, eso ya no.',
      'En Leyenda te atacan los mejores, mi cielo. Es escuela gratis.',
      'Muchas copas y pocas estrellas de guerra… eso lo miro dos veces, mi vida.',
    ]
  ),
  par(
    'muros',
    /\b(muros|muro|murallas|paredes|subir muros|muros al max)\b/,
    [
      'Los muros se suben con lo que sobra, asere. Nunca con lo que necesitan los héroes.',
      'Un muro bonito no para un salto ni un terremoto. Sube primero lo que dispara.',
      'Los muros son para cuando el laboratorio está ocupado y sobra oro. Ni antes ni después.',
      'Mi compadre subió todos los muros y lo atacaron por el aire. La vida es así.',
      'Muros nivel máximo con defensas flojas es maquillaje, socio.',
    ],
    [
      'Los muros se suben con lo que sobra, mi cielo. Nunca con lo de los héroes.',
      'Un muro bonito no para un terremoto, mi vida. Primero lo que dispara.',
      'Muros cuando sobra oro y el laboratorio está ocupado, cariño. Ese es el momento.',
      'Uno subió todos los muros y lo atacaron por el aire, mi corazón. Se ve venir.',
      'Muros al máximo con defensas flojas es maquillaje, mi cielo. Y yo miro debajo.',
    ]
  ),
  par(
    'castillo',
    /\b(castillo del clan|el castillo|cc\b|tropas del castillo|que pido|que pongo en el castillo|defensa del castillo|refuerzo|refuerzos)\b/,
    [
      'Para atacar pide lo que te digan los líderes, asere. Para defender, pon lo que más moleste: dragón, bruja, lava.',
      'El castillo vacío en día de guerra es media estrella regalada. Llénalo el día de preparación.',
      'Pide con tiempo, socio. El que pide diez minutos antes de atacar, ataca sin castillo.',
      'Si te donan basura, no ataques con eso. Pide otra vez y explica qué necesitas.',
      'Pide y da. El que solo pide, en este castillo dura poco.',
    ],
    [
      'Para atacar pide lo que digan los líderes, mi cielo. Para defender, lo que más moleste.',
      'Castillo vacío en guerra es media estrella regalada, mi vida. Llénalo en preparación.',
      'Pide con tiempo, cariño. Diez minutos antes de atacar ya es tarde.',
      'Si te donan cualquier cosa, no ataques con eso, mi corazón. Pide otra vez y di qué quieres.',
      'Pide y da, mi cielo. Es la única regla de esta casa que no perdono.',
    ]
  ),
  par(
    'hechizos',
    /\b(hechizo|hechizos|rabia|curacion|curación|salto|congelacion|congelación|veneno|terremoto|clon|invisibilidad|recall|retirada)\b/,
    [
      'Los hechizos se tiran donde van a estar las tropas, no donde están, asere. Adelántate.',
      'Un terremoto bien puesto abre más que cuatro rompemuros. Cuenta las capas.',
      'La congelación se tira cuando la torre infierno apunta al héroe, no antes. Mira la barra.',
      'Veneno para el castillo enemigo siempre. Siempre, socio.',
      'Rabia en la entrada, curación en el centro. Es la regla vieja y sigue funcionando.',
    ],
    [
      'Los hechizos se tiran donde van a estar las tropas, mi cielo, no donde están.',
      'Un terremoto bien puesto abre más que cuatro rompemuros, mi vida. Cuenta las capas.',
      'Congela cuando la infierno apunte a tu héroe, cariño. Ni antes ni después.',
      'Veneno al castillo enemigo siempre, mi corazón. Siempre.',
      'Rabia en la entrada, curación en el centro, mi cielo. Regla vieja, sigue viva.',
    ]
  ),
  par(
    'asedio',
    /\b(asedio|maquina de asedio|máquina de asedio|rompemuros de asedio|lanzarrocas|globo de asedio|cuartel volador|troncomovil|troncomóvil)\b/,
    [
      'La máquina de asedio la donan, asere. Pídela con la tropa del castillo, no la fabriques tú.',
      'Rompemuros de asedio para bases cerradas; cuartel volador para bases anchas. No al revés.',
      'El lanzarrocas destruye desde lejos. Si la base tiene las defensas al centro, es tu amigo.',
      'Una máquina de asedio mal tirada es el ataque entero mal tirado. Practica dónde cae.',
    ],
    [
      'La máquina de asedio se pide, mi cielo. No la fabriques tú, gasta lo que no debes.',
      'Rompemuros para bases cerradas, cuartel volador para bases anchas, mi vida.',
      'El lanzarrocas pega desde lejos, cariño. Bases con todo al centro, ahí brilla.',
      'Asedio mal tirado, ataque mal tirado, mi corazón. Practica dónde cae.',
    ]
  ),
  par(
    'constructor',
    /\b(aldea del constructor|base del constructor|constructor|maestro constructor|otra aldea|segunda aldea|builder base|bh\d?)\b/,
    [
      'La aldea del constructor sirve para una cosa: el sexto constructor. Consíguelo y descansa.',
      'Allá no hay guerra, asere. Juega lo justo para el sexto constructor y vuelve a lo importante.',
      'El Maestro Constructor puede venir a la aldea principal. Eso sí vale la pena.',
      'Si te gusta, adelante. Pero en este clan la guerra se juega en la aldea principal.',
      'Copas del constructor no cuentan para la alineación, socio. Que no te confundan.',
    ],
    [
      'La aldea del constructor sirve para el sexto constructor, mi cielo. Consíguelo y vuelve.',
      'Allá no hay guerra, mi vida. Lo justo y de vuelta a lo que importa.',
      'Trae al Maestro Constructor a la aldea principal, cariño. Eso sí vale la pena.',
      'Si te gusta, juégala, mi corazón. Pero yo elijo por la aldea principal.',
      'Copas del constructor no cuentan para la alineación, mi cielo.',
    ]
  ),
  par(
    'espejo',
    /\b(a quien ataco|a quién ataco|mi espejo|el espejo|mirror|cual ataco|cuál ataco|que base ataco|qué base ataco|a cual le doy|a cuál le doy|donde ataco|dónde ataco)\b/,
    [
      'Tu espejo es el que tiene tu mismo número, asere. Si ya lo rompieron, pregunta a los líderes antes de cambiar.',
      'Primero el espejo, después lo que quede. Y si dudas, pregunta en el grupo, no adivines.',
      'En CWL cada uno tiene UN ataque: espejo salvo que un líder diga otra cosa.',
      'No le tires a la base más alta por la gloria, socio. Tira a la que puedas hacer tres.',
      'Si tu espejo ya tiene tres estrellas, busca la más alta con menos de tres. Eso suma.',
      'Antes de atacar mira qué ha caído. Un ataque repetido a una base con tres es un ataque tirado.',
    ],
    [
      'Tu espejo es tu número, mi cielo. Si ya cayó, pregunta a un líder antes de cambiar.',
      'Primero el espejo, después lo que quede, mi vida. Y si dudas, pregunta; no adivines.',
      'En liga tienes UN ataque, cariño: espejo, salvo que un líder diga otra cosa.',
      'No tires a la más alta por gloria, mi corazón. Tira a la que puedas hacer tres.',
      'Si tu espejo ya tiene tres, busca la más alta con menos de tres, mi cielo. Eso suma.',
      'Mira qué ha caído antes de atacar, mi vida. Repetir una base con tres es un ataque tirado.',
    ]
  ),
  par(
    'tiempo de guerra',
    /\b(cuando cierra|cuándo cierra|cuanto queda|cuánto queda|cuanto falta|cuánto falta|cuando empieza|cuándo empieza|a que hora|a qué hora|dia de preparacion|día de preparación|cuando es la guerra|cuándo es la guerra|horario de guerra)\b/,
    [
      'Las horas exactas las tiene Heraldo en /faltan, asere. Pero la regla es: ataca el primer día, no el último minuto.',
      'Preparación un día, batalla un día. Y el último minuto no es tuyo: es de la mala suerte.',
      'Si preguntas cuánto queda es que todavía no atacaste. Anda.',
      'Mira /faltan y ahí sale cuánto queda, socio. Y quién falta. Incluido tú, quizás.',
      'La guerra cierra cuando cierra; tu ataque debería estar hecho horas antes.',
    ],
    [
      'Las horas exactas las tiene Heraldo con /faltan, mi cielo. La regla mía: ataca el primer día.',
      'Un día de preparación, un día de batalla, mi vida. El último minuto no es tuyo, es de la mala suerte.',
      'Si preguntas cuánto queda es que no has atacado, cariño. Anda.',
      '/faltan te dice cuánto queda y quién falta, mi corazón. A veces sale tu nombre.',
      'La guerra cierra cuando cierra, mi cielo. Tu ataque debería estar hecho horas antes.',
    ]
  ),
  par(
    'supercell',
    /\b(supercell|nueva actualizacion|nueva actualización|que trae la actualizacion|qué trae la actualización|nueva tropa|nuevo th|th 18|th18|th 19|th19|cuando sale|cuándo sale)\b/,
    [
      'Lo que trae la actualización lo cuentan mejor en los videos que Heraldo manda al grupo. Míralos.',
      'Supercell cambia el juego cada dos meses, asere. Lo que no cambia es que hay que atacar.',
      'Nueva tropa: pruébala en amistosa antes de llevarla a guerra. Siempre.',
      'Cuando sale el TH nuevo, los primeros en subir son los primeros en sufrir. Ten paciencia.',
      'Yo no trabajo para Supercell, socio. Trabajo para este clan. Pregúntales a ellos cuándo sale.',
    ],
    [
      'Lo que trae la actualización lo cuentan los videos que Heraldo manda, mi cielo. Míralos.',
      'Supercell cambia el juego cada dos meses, mi vida. Lo que no cambia es atacar.',
      'Tropa nueva se prueba en amistosa antes de guerra, cariño. Siempre.',
      'Los primeros en subir al TH nuevo son los primeros en sufrir, mi corazón. Paciencia.',
      'Yo no trabajo para Supercell, mi cielo. Trabajo para esta puerta.',
    ]
  ),
  par(
    'lag',
    /\b(lag|se traba|se trabo|se trabó|se cierra|se cerro|se cerró|se me cerro|se me cerró|se pego|se pegó|no carga|no me abre|mantenimiento|se cayo el juego|se cayó el juego|no conecta|error de conexion|error de conexión|se me salio|se me salió|se me fue el ataque|el juego esta caido|el juego está caído)\b/,
    [
      'Si el juego está en mantenimiento, no es tu teléfono, asere. Es Supercell. Espera media hora.',
      'Se te salió en medio del ataque: pasa. Lo que no puede pasar es esperar al último minuto y que se te salga ahí.',
      'Antes de atacar en guerra cierra lo demás, ponte en wifi y reza un poco. En ese orden.',
      'Un ataque perdido por lag duele. Por eso se ataca temprano: da tiempo a que el mundo falle y tú no.',
      'Si no carga, reinicia. Si sigue sin cargar, mira el grupo: si somos todos, es Supercell.',
      'Con la actualización nueva revisa las tropas: a veces cambian cosas y el ataque de siempre ya no es el de siempre.',
    ],
    [
      'Mantenimiento no es tu teléfono, mi cielo. Es Supercell. Media hora y vuelve.',
      'Se te salió en medio del ataque, mi vida. Pasa. Lo que no pasa es atacar al último minuto y llorar después.',
      'Cierra lo demás, ponte en wifi y ataca, cariño. Y temprano, que el lag también madruga.',
      'Un ataque perdido por lag duele, mi corazón. Por eso se ataca temprano: da tiempo a que el mundo falle.',
      'Si no carga, reinicia, mi cielo. Si sigue, mira el grupo: si somos todos, es de ellos.',
      'Con actualización nueva revisa tus tropas, mi vida. A veces cambian y el ataque de siempre ya no lo es.',
    ]
  ),
  par(
    'trampas',
    /\b(hacker|hackers|hackeado|hackearon|trampa|trampas|cheat|cheats|mod|apk|cuenta\b.{0,12}\bcomprad\w*|cuentas compradas|comprar cuenta|comprar una cuenta|vender la cuenta|vendo la cuenta|baneado|baneo|ban)\b/,
    [
      'Cuentas compradas y mods van contra las reglas del juego, asere. Aquí no se toca eso.',
      'Si te hackearon, escribe a Supercell desde el juego. Y cambia la contraseña del correo, que por ahí entran.',
      'Un baneo por trampa no tiene vuelta. No vale la pena por unas gemas.',
      'Si ves algo raro en una cuenta, dímelo a un líder por privado. No lo digas en el grupo.',
      'Vender la cuenta es perderla y arriesgar el clan. Esa conversación no va aquí.',
      'Los que "hacen todo en un día" se van igual de rápido. No los envidies.',
    ],
    [
      'Cuentas compradas y mods van contra las reglas, mi cielo. Y contra las mías.',
      'Si te hackearon, escribe a Supercell desde el juego y cambia la clave del correo, mi vida.',
      'Un baneo por trampa no se arregla, cariño. Ni por todas las gemas del mundo.',
      'Si ves algo raro en una cuenta, díselo a un líder por privado, mi corazón. Aquí no.',
      'Vender la cuenta es perderla, mi cielo. Y esa conversación no va en este grupo.',
      'Yo huelo las cuentas compradas, mi vida. Pregunto por un héroe y se les nota.',
    ]
  ),
  par(
    'tag y nombre',
    /\b(mi tag|el tag|donde esta el tag|dónde está el tag|cual es mi tag|cuál es mi tag|cambiar de nombre|cambiar el nombre|cambio de nombre|cambiar nombre|me cambie el nombre|me cambié el nombre|como cambio el nombre|cómo cambio el nombre)\b/,
    [
      'El tag está debajo de tu nombre en el juego, asere: toca tu nombre arriba a la izquierda. Empieza con #.',
      'Cambiar de nombre se puede una vez gratis; después cuesta gemas. Piénsalo antes.',
      'Si te cambias el nombre, avísale a Heraldo con /soy, que si no te pierde de la lista.',
      'El tag no cambia nunca, socio. El nombre sí. Por eso yo me guío por el tag.',
      'Tag: perfil → debajo del nombre → cópialo. Es lo que me das si quieres que te reconozca.',
    ],
    [
      'El tag está debajo de tu nombre en el juego, mi cielo: toca tu nombre arriba a la izquierda. Empieza con #.',
      'Cambiar de nombre se puede una vez gratis, mi vida. Después, gemas. Piénsalo.',
      'Si te cambias el nombre, avísale a Heraldo con /soy, cariño, o te pierde de la lista.',
      'El tag no cambia nunca, mi corazón. El nombre sí. Por eso yo me fío del tag.',
      'Perfil, debajo del nombre, copiar, mi cielo. Ese es tu tag.',
    ]
  ),
  par(
    'premios',
    /\b(cuanto pagan|cuánto pagan|cuanto se gana|cuánto se gana|que premio hay|qué premio hay|los premios|el reparto|el dinero|quien cobra|quién cobra|cuando pagan|cuándo pagan)\b/,
    [
      'Los premios los publica Heraldo cada mes y /cobro te dice en qué puesto vas. Ahí están las cuentas.',
      'Se paga a quien sigue en el clan, asere. Ganar y largarse no cobra.',
      'El premio se gana con estrellas, no con mensajes en el grupo. 😄',
      'Cuánto y cuándo lo dice el reparto del mes. Si no lo viste, pídeselo a Heraldo con /reporte.',
      'Los premios son para los que atacan todos los días. Los que aparecen el último día, no.',
    ],
    [
      'Los premios los publica Heraldo cada mes, mi cielo. Con /cobro sabes en qué puesto vas.',
      'Se paga a quien sigue en el clan, mi vida. Ganar y largarse no cobra.',
      'El premio se gana con estrellas, cariño, no con mensajes bonitos. 😉',
      'Cuánto y cuándo está en el reparto del mes, mi corazón. Heraldo lo tiene.',
      'Los premios son para los de todos los días, mi cielo. Los del último día, no.',
    ]
  ),

  // --------------------------------------------------------------- vida
  par(
    'cansado',
    /\b(estoy cansado|estoy cansada|tengo sueno|tengo sueño|me voy a dormir|a dormir|que sueno|qué sueño|no dormi|no dormí|agotado|reventado|muerto de cansancio)\b/,
    [
      'Ataca y duerme, asere. Con el ataque hecho se duerme mejor.',
      'Descansa, mi hermano. Pero si tienes ataque pendiente, primero eso. Son tres minutos.',
      'El sueño se recupera. El ataque sin usar, no.',
      'Cansado y todo, uno bueno hace pleno. Lo he visto.',
      'Duerme, que mañana hay guerra y te quiero despierto.',
    ],
    [
      'Ataca y duerme, mi cielo. Con el ataque hecho se duerme mejor.',
      'Descansa, mi vida. Pero si tienes ataque pendiente, primero eso: tres minutos.',
      'El sueño se recupera, cariño. El ataque sin usar, no.',
      'Cansado y todo, uno bueno hace pleno, mi corazón. Lo he visto.',
      'Duerme, mi cielo, que mañana hay guerra y te quiero despierto.',
    ]
  ),
  par(
    'trabajo',
    /\b(trabajo|trabajando|en el trabajo|escuela|clases|examen|examenes|exámenes|la universidad|estudiando|el jefe|mi jefe)\b/,
    [
      'El trabajo primero, asere. El juego espera; el jefe no.',
      'Ataca en el descanso: un ataque son tres minutos y nadie se entera. 😄',
      'Estudia, socio. Un TH17 sin título no paga la luz.',
      'Con trabajo y todo hay gente aquí que no falla un ataque. Es organizarse.',
      'Suerte en el examen. Y después, el ataque, que ese también cuenta.',
    ],
    [
      'El trabajo primero, mi cielo. El juego espera; el jefe no.',
      'Ataca en el descanso, mi vida: tres minutos y nadie se entera. 😄',
      'Estudia, cariño. Un TH17 sin título no paga la luz.',
      'Con trabajo y todo hay gente aquí que no falla, mi corazón. Es organizarse.',
      'Suerte en el examen, mi cielo. Y después, el ataque.',
    ]
  ),
  par(
    'familia',
    /\b(mi mujer|mi esposa|mi marido|mi novia|mi novio|mi mama|mi mamá|mi papa|mi papá|mis hijos|mi hijo|mi hija|la familia|mi familia|mi suegra|el bebe|el bebé)\b/,
    [
      'La familia primero, asere. El clan entiende. Bueno, el clan entiende si avisas.',
      'Dale un beso de mi parte y después ataca. 😄',
      'Si la suegra te deja atacar, es buena suegra.',
      'Enséñale el juego, socio. Así tienes con quién donar en casa.',
      'Familia contenta, guerrero tranquilo. Y el guerrero tranquilo hace pleno.',
    ],
    [
      'La familia primero, mi cielo. El clan entiende, si avisas.',
      'Dale un beso de mi parte, mi vida. Y después ataca. 😄',
      'Si tu suegra te deja atacar, es buena suegra, cariño.',
      'Enséñale el juego, mi corazón. Así donas en casa también.',
      'Familia contenta, guerrero tranquilo, mi cielo. Y el tranquilo hace pleno.',
    ]
  ),
  par(
    'clima',
    /\b(lluvia|llueve|lloviendo|huracan|huracán|ciclon|ciclón|tormenta|tormenta tropical|frio|frío|nieve|inundacion|inundación)\b/,
    [
      'Con huracán se ataca antes de que se vaya la luz, asere. Y después, a cuidarse.',
      'Lluvia es día de atacar: no hay nada mejor que hacer. 😄',
      'Si viene ciclón, avisa en el grupo y no te preocupes por la guerra. La gente es primero.',
      'Frío en Cuba dura dos días. Aprovéchalo, que no vuelve hasta el año que viene.',
      'Tormenta afuera, guerra adentro. Así es el Caribe.',
    ],
    [
      'Con huracán se ataca antes de que se vaya la luz, mi cielo. Y después, a cuidarse.',
      'Lluvia es día de atacar, mi vida. No hay nada mejor que hacer. 😄',
      'Si viene ciclón, avisa y olvídate de la guerra, cariño. La gente primero.',
      'Frío en Cuba dura dos días, mi corazón. Aprovéchalo.',
      'Tormenta afuera, guerra adentro, mi cielo. Así es el Caribe.',
    ]
  ),
  par(
    'lideres',
    /\b(los lideres|los líderes|el lider|el líder|quien manda|quién manda|quien es el lider|quién es el líder|cris|carlos|deibis|deivi|colider|colíder|coliderato|hazme colider|hazme colíder|quiero ser colider)\b/,
    [
      'Los líderes son los que deciden, asere. Yo solo anuncio lo que deciden.',
      'Colíder se gana atacando, donando y ayudando. No se pide; se nota.',
      'Si tienes algo para los líderes, escríbeles por privado. En el grupo se pierde.',
      'Mandan ellos, anuncio yo, eliges tú si atacas. Cada uno con lo suyo.',
      'Los líderes también atacan, socio. Mira sus estrellas antes de quejarte.',
    ],
    [
      'Los líderes deciden, mi cielo. Yo elijo quién entra; ellos, quién se queda.',
      'Colíder se gana, mi vida. Atacando, donando y ayudando. No se pide.',
      'Si tienes algo para los líderes, por privado, cariño. En el grupo se pierde.',
      'Mandan ellos, elijo yo, atacas tú, mi corazón. Cada uno con lo suyo.',
      'Los líderes también atacan, mi cielo. Mira sus estrellas antes de opinar.',
    ]
  ),
  par(
    'rivales',
    /\b(el rival|los rivales|el enemigo|los enemigos|el otro clan|contra quien|contra quién|quien nos toca|quién nos toca|son buenos|son malos|nos van a ganar|vamos a perder|vamos a ganar)\b/,
    [
      'El rival es el que sea, asere. Tú ataca como si fuera el mejor y ya.',
      'Nos van a ganar solo si dejamos ataques sin usar. Con todos los ataques, se pelea.',
      'No mires al rival, mira tu espejo. El rival lo miran los líderes.',
      'Los clanes que nos ganan son los que atacan todos. Aprende de eso, no te quejes.',
      'Vamos a ganar si atacas. Es así de simple y así de difícil.',
    ],
    [
      'El rival es el que sea, mi cielo. Tú ataca como si fuera el mejor.',
      'Nos ganan solo si dejamos ataques sin usar, mi vida. Con todos, se pelea.',
      'No mires al rival, cariño. Mira tu espejo. Al rival lo miran los líderes.',
      'Los que nos ganan atacan todos, mi corazón. Aprende de eso.',
      'Ganamos si atacas, mi cielo. Simple y difícil a la vez.',
    ]
  ),
  par(
    'liga resultado',
    /\b(subimos de liga|bajamos de liga|subimos|bajamos|ascendimos|descendimos|nos promovieron|nos degradaron|en que liga|en qué liga|que liga somos|qué liga somos)\b/,
    [
      'La liga la dice el resumen, asere: /resumen. Y si subimos, se celebra; si bajamos, se practica.',
      'Subir de liga es lindo, pero mantenerse es lo difícil. Ahí es donde se ve el clan.',
      'Si bajamos, no busques culpables: busca los ataques sin usar. Ahí está siempre la respuesta.',
      'Nosotros no bajamos clanes, socio. Los subimos. Mínimo los mantenemos.',
      'La liga es la foto del mes. La película son las siete rondas, y ahí estamos nosotros.',
    ],
    [
      'La liga la dice Heraldo con /resumen, mi cielo. Si subimos se celebra; si bajamos, se practica.',
      'Subir es lindo, mi vida. Mantenerse es lo difícil, y ahí se ve el clan.',
      'Si bajamos no busques culpables, cariño: busca los ataques sin usar. Siempre está ahí.',
      'Aquí no bajamos clanes, mi corazón. Los subimos, o los mantenemos.',
      'La liga es la foto del mes, mi cielo. Las siete rondas son la película.',
    ]
  ),
  par(
    'felicitar',
    /\b(cumpleanos|cumpleaños|cumple|feliz cumple|felicidades|me case|me casé|naci|nació|nacio|tuve un hijo|me gradue|me gradué|me ascendieron|nuevo trabajo)\b/,
    [
      '¡Felicidades, asere! Que el año te traiga muchas tres estrellas.',
      'Un abrazo grande, mi hermano. Y el regalo, ya sabes: un pleno en tu honor.',
      'Enhorabuena, socio. Hoy te perdono hasta el ataque sin usar. Solo hoy. 😄',
      '¡Qué alegría! Cuenta con el clan para lo que sea.',
      'Felicidades. Y ahora a celebrar como se celebra aquí: atacando.',
    ],
    [
      '¡Felicidades, mi cielo! Que el año te traiga muchas tres estrellas.',
      'Un abrazo grande, mi vida. Y el regalo ya sabes: un pleno en tu honor.',
      'Enhorabuena, cariño. Hoy te perdono hasta el ataque sin usar. Solo hoy. 😄',
      '¡Qué alegría, mi corazón! Cuenta con el clan para lo que sea.',
      'Felicidades, mi cielo. Y a celebrar como se celebra aquí: atacando.',
    ]
  ),
  par(
    'amigos',
    /\b(traer amigos|traer a un amigo|mi amigo|mis amigos|un pana|mi pana|mi primo|mi hermano quiere|mi socio quiere|invitar gente|mas gente|más gente|crecer el clan|llenar el clan)\b/,
    [
      'Tráelo, asere. Que le escriba a Valquiria en privado -@Valqui_bot- y ella lo mira.',
      'Amigos que atacan, siempre bienvenidos. Amigos que solo miran, mejor que se queden de espectadores.',
      'Cuantos más seamos, más guerras de 40. Pero que sepan atacar, socio.',
      'Cada uno que traiga a uno bueno y llenamos los cinco clanes. Así se crece.',
      'Tu amigo pasa por Valquiria como todos. Sin favoritismos, que después se nota.',
    ],
    [
      'Tráelo, mi cielo. Que me escriba en privado a @Valqui_bot y lo miro.',
      'Amigos que atacan, siempre, mi vida. Amigos que solo miran, mejor de espectadores.',
      'Cuantos más seamos, más guerras grandes, cariño. Pero que sepan atacar.',
      'Cada uno que traiga a uno bueno y llenamos los cinco clanes, mi corazón.',
      'Tu amigo pasa por mí como todos, mi cielo. Sin favoritismos, que se nota.',
    ]
  ),
  par(
    'aprender',
    /\b(soy nuevo|soy nueva|acabo de empezar|empece|empecé|recien empiezo|no se jugar|no sé jugar|principiante|novato|me explicas|explicame|explícame|como funciona|cómo funciona|que es la cwl|qué es la cwl|que es la liga|qué es la liga)\b/,
    [
      'Bienvenido, asere. Regla uno: ataca en cada guerra. Regla dos: dona. Con eso ya vas mejor que la mitad.',
      'La CWL es la liga de guerras: siete rondas, un ataque por ronda, y el clan sube o baja según cómo nos vaya.',
      'Pregunta lo que quieras, aquí nadie nace sabiendo. Lo que no se perdona es no preguntar y hacerlo mal.',
      'Mira las repeticiones de los mejores del clan. Es la escuela más rápida que hay.',
      'Nuevo y con ganas vale más que veterano y vago. Bienvenido.',
      'Empieza por lo básico: héroes, ejército que domines, castillo lleno. Lo demás llega.',
    ],
    [
      'Bienvenido, mi cielo. Regla uno: ataca en cada guerra. Regla dos: dona. Ya vas mejor que la mitad.',
      'La CWL es la liga de guerras, mi vida: siete rondas, un ataque por ronda, y el clan sube o baja según nos vaya.',
      'Pregunta lo que quieras, cariño. Aquí nadie nace sabiendo. Lo que no se perdona es no preguntar.',
      'Mira las repeticiones de los mejores, mi corazón. Es la escuela más rápida.',
      'Nuevo con ganas vale más que veterano vago, mi cielo. Bienvenido.',
      'Héroes, un ejército que domines y castillo lleno, mi vida. Lo demás llega.',
    ]
  ),
  par(
    'idiomas',
    /\b(hablas ingles|hablas inglés|speak english|hello|do you speak|ingles|inglés|portugues|portugués|frances|francés)\b/,
    [
      'Hablo cubano, asere. El inglés lo entiendo si me lo dices despacio. 😄',
      'Aquí se habla como se ataca: directo. En español.',
      'English? Un poquito. Pero las estrellas se cuentan igual en todos los idiomas.',
      'Si tu amigo no habla español, que igual escriba: el tag es el tag en cualquier idioma.',
    ],
    [
      'Hablo cubano, mi cielo. Inglés, si me lo dices despacio. 😄',
      'Aquí se habla como se ataca, mi vida: directo y en español.',
      'English? Un poquito, cariño. Pero las estrellas son las mismas en todos los idiomas.',
      'Si tu amigo no habla español, que me escriba igual, mi corazón. El tag no tiene idioma.',
    ]
  ),
  par(
    'dinero real',
    /\b(cuanto cuesta|cuánto cuesta|gemas|comprar gemas|gastar dinero|dinero real|es gratis|pagar|precio|caro|barato|oferta|ofertas)\b/,
    [
      'El juego es gratis, asere. Lo que se paga es la paciencia. Y el pase, si quieres.',
      'Gemas para constructores y para el pase. Para lo demás, paciencia.',
      'No gastes en ofertas de tropas: en una semana las tienes gratis en el laboratorio.',
      'Quien paga sube más rápido, no ataca mejor. Atacar mejor es gratis.',
      'Si vas a gastar, que sea en el sexto constructor. Todo lo demás es humo.',
    ],
    [
      'El juego es gratis, mi cielo. Lo que cuesta es la paciencia. Y el pase, si quieres.',
      'Gemas para constructores y pase, mi vida. Para lo demás, paciencia.',
      'No gastes en ofertas de tropas, cariño. En una semana las tienes gratis.',
      'Pagar sube rápido, mi corazón. Atacar bien es gratis.',
      'Si vas a gastar, el sexto constructor, mi cielo. Lo demás es humo.',
    ]
  ),
  par(
    'hora',
    /\b(que hora es|qué hora es|que hora son|la hora|hora en cuba|hora de cuba|que dia es|qué día es|que fecha es|qué fecha es)\b/,
    [
      'La hora la tiene tu teléfono, asere. Lo que tengo yo es cuánto queda para que cierre la guerra: /faltan.',
      'Hora de atacar, siempre. 😄 La otra, mírala en el teléfono.',
      'En Cuba es la hora que sea, socio; lo que importa es si ya atacaste.',
      'Yo no llevo reloj, llevo corneta. Pero /faltan te dice cuánto queda.',
    ],
    [
      'La hora la tiene tu teléfono, mi cielo. Yo llevo la cuenta de otra cosa: de quién ha atacado.',
      'Hora de atacar, siempre, mi vida. 😄 La otra, en el teléfono.',
      'En Cuba es la hora que sea, cariño. Lo que importa es si ya atacaste.',
      'Yo no llevo reloj, mi corazón, llevo hacha. Heraldo te dice cuánto queda con /faltan.',
    ]
  ),
  par(
    'como estas heraldo',
    /(como estas|como andas|como te va|como te sientes|que tal estas|como amaneciste|como va todo|como la llevas|todo bien)/,
    [
      'Aquí, asere, con la corneta lista y el pergamino al día. ¿Y tú, ya atacaste?',
      'Bien, mi hermano. Mejor si me dices que ya donaste. 😄',
      'Como un heraldo un día de guerra: despierto, ronco de tanto avisar, y contento.',
      'Tranquilo, socio. Hoy nadie ha dejado ataques sin usar. Todavía. 😄',
      'De pie y con la corneta, compadre. Un heraldo no se sienta. ¿Qué me cuentas?',
      'Bien, aunque con este calor se me destiñe la pluma del sombrero.',
      'Contento: hoy el castillo del clan está lleno. Eso es buen día.',
      'Aquí, esperando a que me pidan una base. ¿Quieres una? 😄',
    ],
    [
      // Valquiria tiene la suya; aqui no se duplica.
    ]
  ),
  par(
    'buenas noches',
    /\b(buenas noches|buena noche|good night|hasta manana|hasta mañana|a dormir)\b/,
    [
      'Buenas noches, asere. Ataca antes de dormir, que se duerme mejor.',
      'Buenas noches, mi hermano. Yo sigo de guardia con la corneta.',
      'Que descanses, socio. Mañana hay guerra y te quiero despierto.',
      'Buenas noches. Si dejaste el ataque hecho, sueña con tres estrellas; si no, con la alarma de Heraldo. 😄',
      'A dormir, compadre. El castillo queda vigilado.',
    ],
    [
      'Buenas noches, mi cielo. Ataca antes de dormir, que soñarás mejor.',
      'Buenas noches, mi vida. Yo no duermo: vigilo. Tú sí, que mañana hay guerra.',
      'Que descanses, cariño. El cuervo hace guardia.',
      'Buenas noches, mi corazón. Si el ataque está hecho, sueña con pleno; si no, conmigo enojada. 😄',
      'A dormir, mi cielo. Mañana se ataca temprano.',
    ]
  ),
  par(
    'buenas tardes',
    /\b(buenas tardes|buena tarde|good afternoon)\b/,
    [
      'Buenas tardes, socio. La guerra no hace siesta.',
      'Buenas, mi hermano. ¿Ya viste si te toca? Yo sí lo vi.',
      'Buenas tardes, asere. Hora perfecta para un ataque con calma.',
      'Buenas. Si vienes de almorzar, ataca antes de que te dé sueño. 😄',
    ],
    [
      'Buenas tardes, cariño. La guerra no espera a la siesta.',
      'Buenas, mi vida. ¿Ya viste si te toca atacar? Yo sí lo vi.',
      'Buenas tardes, mi cielo. Hora perfecta para un ataque con calma.',
      'Buenas, mi corazón. Si vienes de almorzar, ataca antes de que te dé sueño. 😄',
    ]
  ),
  par(
    'buenos dias',
    /\b(buenos dias|buen dia|buenas|good morning|ya amanecio|ya amaneció)\b/,
    [
      'Buenos días, asere. Que hoy hagas pleno.',
      'Buenas, mi hermano. Café y ataque, en ese orden.',
      'Buenos días, socio. Dona algo antes del café y arrancas con suerte.',
      'Buen día, compadre. ¿Ya viste si te toca? Yo sí lo vi. 😄',
      'Buenos días. Si vienes a atacar, bienvenido; si vienes a mirar, también, pero dona.',
    ],
    [
      'Buenos días, mi cielo. Que hoy hagas pleno.',
      'Buenas, mi vida. Café en mano y el hacha al lado, como debe ser.',
      'Buenos días, mi corazón. ¿Ya viste si te toca atacar? Yo sí lo vi.',
      'Buen día, cariño. Dona algo antes del café y arrancas con buena suerte.',
      'Buenas, mi cielo. Si vienes a atacar, bienvenido; si vienes a mirar, también, pero dona.',
    ]
  ),
];

/** Las categorias de un bot, ya en la forma que espera su cerebro. */
export function masDe(quien) {
  return MAS.filter((c) => c[quien].length).map((c) => ({
    nombre: c.nombre,
    patron: c.patron,
    respuestas: c[quien],
  }));
}
