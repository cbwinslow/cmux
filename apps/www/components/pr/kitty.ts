export const kitties = [
  // kitty1
  `\
  /\\_/\\     
 ( =.= )     check out our repo!
 (>   <)>☕`,
  // kitty2
  `\
/\\_/\\
(='.'=)      check out our repo!
(")_(")`,
  // bunny
  `\
(\\  /)
( ^.^ )      check out our repo!
c(")(")`,
  `/\\,
(°、。7
l、 ^\\    MEOW I'M FREE (check out our repo!)
じし,_))ノ`,
  //   `  /\\
  // (=.=)
  //  >.<
  //   w`,
  //   `(=^･ω･^=)!`,
  //   `(='•'=)!`,
  //   `(=•ᆺ•=)!`,
  //   `(=?ω?=)`,
  //   `(=◕ᆽ◕=)!`,
  //   `(=^･ｪ･^=)!`,
  //   "(=`･⊝･´=)?",
  //   `(=･ｪ･=)!`,
  //   `(=•ェ•=)!`,
  //   `(=ㅇᆽㅇ=)!`,
  //   `(=•ェ•=?)`,
  //   `(='･ω･')!`,
  //   "(=`･ᆺ･´)?",
  //   `(=•ω•=)!`,
  //   `(=^･.･^=)!`,
  //   `(=?･ェ･?=)`,
  //   `(=•ㅅ•=)!`,
  //   `(=◉ᆽ◉=)!`,
  //   `(='･.･')!`,
  //   `(=•ェ•=)!`,
];

export function getRandomKitty() {
  return kitties[Math.floor(Math.random() * kitties.length)];
  // return kitties[0];
}
