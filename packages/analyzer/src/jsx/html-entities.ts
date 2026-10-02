// HTML's named character references that JSX does not decode: WHATWG's list
// (https://html.spec.whatwg.org/entities.json), which the standard no longer changes, less the
// XHTML 1.0 names JSX knows (`XHTML_ENTITIES`). Each is `name:code points`, in hex. Generated
// once; a test checks every entry against parse5's decoding, and the count against the list's.
const LIST = `
  AMP:26 Abreve:102 Acy:410 Afr:1D504 Amacr:100 And:2A53 Aogon:104 Aopf:1D538 ApplyFunction:2061
  Ascr:1D49C Assign:2254 Backslash:2216 Barv:2AE7 Barwed:2306 Bcy:411 Because:2235 Bernoullis:212C
  Bfr:1D505 Bopf:1D539 Breve:2D8 Bscr:212C Bumpeq:224E CHcy:427 COPY:A9 Cacute:106 Cap:22D2
  CapitalDifferentialD:2145 Cayleys:212D Ccaron:10C Ccirc:108 Cconint:2230 Cdot:10A Cedilla:B8
  CenterDot:B7 Cfr:212D CircleDot:2299 CircleMinus:2296 CirclePlus:2295 CircleTimes:2297
  ClockwiseContourIntegral:2232 CloseCurlyDoubleQuote:201D CloseCurlyQuote:2019 Colon:2237
  Colone:2A74 Congruent:2261 Conint:222F ContourIntegral:222E Copf:2102 Coproduct:2210
  CounterClockwiseContourIntegral:2233 Cross:2A2F Cscr:1D49E Cup:22D3 CupCap:224D DD:2145
  DDotrahd:2911 DJcy:402 DScy:405 DZcy:40F Darr:21A1 Dashv:2AE4 Dcaron:10E Dcy:414 Del:2207
  Dfr:1D507 DiacriticalAcute:B4 DiacriticalDot:2D9 DiacriticalDoubleAcute:2DD DiacriticalGrave:60
  DiacriticalTilde:2DC Diamond:22C4 DifferentialD:2146 Dopf:1D53B Dot:A8 DotDot:20DC DotEqual:2250
  DoubleContourIntegral:222F DoubleDot:A8 DoubleDownArrow:21D3 DoubleLeftArrow:21D0
  DoubleLeftRightArrow:21D4 DoubleLeftTee:2AE4 DoubleLongLeftArrow:27F8
  DoubleLongLeftRightArrow:27FA DoubleLongRightArrow:27F9 DoubleRightArrow:21D2
  DoubleRightTee:22A8 DoubleUpArrow:21D1 DoubleUpDownArrow:21D5 DoubleVerticalBar:2225
  DownArrow:2193 DownArrowBar:2913 DownArrowUpArrow:21F5 DownBreve:311 DownLeftRightVector:2950
  DownLeftTeeVector:295E DownLeftVector:21BD DownLeftVectorBar:2956 DownRightTeeVector:295F
  DownRightVector:21C1 DownRightVectorBar:2957 DownTee:22A4 DownTeeArrow:21A7 Downarrow:21D3
  Dscr:1D49F Dstrok:110 ENG:14A Ecaron:11A Ecy:42D Edot:116 Efr:1D508 Element:2208 Emacr:112
  EmptySmallSquare:25FB EmptyVerySmallSquare:25AB Eogon:118 Eopf:1D53C Equal:2A75 EqualTilde:2242
  Equilibrium:21CC Escr:2130 Esim:2A73 Exists:2203 ExponentialE:2147 Fcy:424 Ffr:1D509
  FilledSmallSquare:25FC FilledVerySmallSquare:25AA Fopf:1D53D ForAll:2200 Fouriertrf:2131
  Fscr:2131 GJcy:403 GT:3E Gammad:3DC Gbreve:11E Gcedil:122 Gcirc:11C Gcy:413 Gdot:120 Gfr:1D50A
  Gg:22D9 Gopf:1D53E GreaterEqual:2265 GreaterEqualLess:22DB GreaterFullEqual:2267
  GreaterGreater:2AA2 GreaterLess:2277 GreaterSlantEqual:2A7E GreaterTilde:2273 Gscr:1D4A2 Gt:226B
  HARDcy:42A Hacek:2C7 Hat:5E Hcirc:124 Hfr:210C HilbertSpace:210B Hopf:210D HorizontalLine:2500
  Hscr:210B Hstrok:126 HumpDownHump:224E HumpEqual:224F IEcy:415 IJlig:132 IOcy:401 Icy:418
  Idot:130 Ifr:2111 Im:2111 Imacr:12A ImaginaryI:2148 Implies:21D2 Int:222C Integral:222B
  Intersection:22C2 InvisibleComma:2063 InvisibleTimes:2062 Iogon:12E Iopf:1D540 Iscr:2110
  Itilde:128 Iukcy:406 Jcirc:134 Jcy:419 Jfr:1D50D Jopf:1D541 Jscr:1D4A5 Jsercy:408 Jukcy:404
  KHcy:425 KJcy:40C Kcedil:136 Kcy:41A Kfr:1D50E Kopf:1D542 Kscr:1D4A6 LJcy:409 LT:3C Lacute:139
  Lang:27EA Laplacetrf:2112 Larr:219E Lcaron:13D Lcedil:13B Lcy:41B LeftAngleBracket:27E8
  LeftArrow:2190 LeftArrowBar:21E4 LeftArrowRightArrow:21C6 LeftCeiling:2308
  LeftDoubleBracket:27E6 LeftDownTeeVector:2961 LeftDownVector:21C3 LeftDownVectorBar:2959
  LeftFloor:230A LeftRightArrow:2194 LeftRightVector:294E LeftTee:22A3 LeftTeeArrow:21A4
  LeftTeeVector:295A LeftTriangle:22B2 LeftTriangleBar:29CF LeftTriangleEqual:22B4
  LeftUpDownVector:2951 LeftUpTeeVector:2960 LeftUpVector:21BF LeftUpVectorBar:2958
  LeftVector:21BC LeftVectorBar:2952 Leftarrow:21D0 Leftrightarrow:21D4 LessEqualGreater:22DA
  LessFullEqual:2266 LessGreater:2276 LessLess:2AA1 LessSlantEqual:2A7D LessTilde:2272 Lfr:1D50F
  Ll:22D8 Lleftarrow:21DA Lmidot:13F LongLeftArrow:27F5 LongLeftRightArrow:27F7
  LongRightArrow:27F6 Longleftarrow:27F8 Longleftrightarrow:27FA Longrightarrow:27F9 Lopf:1D543
  LowerLeftArrow:2199 LowerRightArrow:2198 Lscr:2112 Lsh:21B0 Lstrok:141 Lt:226A Map:2905 Mcy:41C
  MediumSpace:205F Mellintrf:2133 Mfr:1D510 MinusPlus:2213 Mopf:1D544 Mscr:2133 NJcy:40A
  Nacute:143 Ncaron:147 Ncedil:145 Ncy:41D NegativeMediumSpace:200B NegativeThickSpace:200B
  NegativeThinSpace:200B NegativeVeryThinSpace:200B NestedGreaterGreater:226B NestedLessLess:226A
  NewLine:A Nfr:1D511 NoBreak:2060 NonBreakingSpace:A0 Nopf:2115 Not:2AEC NotCongruent:2262
  NotCupCap:226D NotDoubleVerticalBar:2226 NotElement:2209 NotEqual:2260 NotEqualTilde:2242+338
  NotExists:2204 NotGreater:226F NotGreaterEqual:2271 NotGreaterFullEqual:2267+338
  NotGreaterGreater:226B+338 NotGreaterLess:2279 NotGreaterSlantEqual:2A7E+338
  NotGreaterTilde:2275 NotHumpDownHump:224E+338 NotHumpEqual:224F+338 NotLeftTriangle:22EA
  NotLeftTriangleBar:29CF+338 NotLeftTriangleEqual:22EC NotLess:226E NotLessEqual:2270
  NotLessGreater:2278 NotLessLess:226A+338 NotLessSlantEqual:2A7D+338 NotLessTilde:2274
  NotNestedGreaterGreater:2AA2+338 NotNestedLessLess:2AA1+338 NotPrecedes:2280
  NotPrecedesEqual:2AAF+338 NotPrecedesSlantEqual:22E0 NotReverseElement:220C
  NotRightTriangle:22EB NotRightTriangleBar:29D0+338 NotRightTriangleEqual:22ED
  NotSquareSubset:228F+338 NotSquareSubsetEqual:22E2 NotSquareSuperset:2290+338
  NotSquareSupersetEqual:22E3 NotSubset:2282+20D2 NotSubsetEqual:2288 NotSucceeds:2281
  NotSucceedsEqual:2AB0+338 NotSucceedsSlantEqual:22E1 NotSucceedsTilde:227F+338
  NotSuperset:2283+20D2 NotSupersetEqual:2289 NotTilde:2241 NotTildeEqual:2244
  NotTildeFullEqual:2247 NotTildeTilde:2249 NotVerticalBar:2224 Nscr:1D4A9 Ocy:41E Odblac:150
  Ofr:1D512 Omacr:14C Oopf:1D546 OpenCurlyDoubleQuote:201C OpenCurlyQuote:2018 Or:2A54 Oscr:1D4AA
  Otimes:2A37 OverBar:203E OverBrace:23DE OverBracket:23B4 OverParenthesis:23DC PartialD:2202
  Pcy:41F Pfr:1D513 PlusMinus:B1 Poincareplane:210C Popf:2119 Pr:2ABB Precedes:227A
  PrecedesEqual:2AAF PrecedesSlantEqual:227C PrecedesTilde:227E Product:220F Proportion:2237
  Proportional:221D Pscr:1D4AB QUOT:22 Qfr:1D514 Qopf:211A Qscr:1D4AC RBarr:2910 REG:AE Racute:154
  Rang:27EB Rarr:21A0 Rarrtl:2916 Rcaron:158 Rcedil:156 Rcy:420 Re:211C ReverseElement:220B
  ReverseEquilibrium:21CB ReverseUpEquilibrium:296F Rfr:211C RightAngleBracket:27E9
  RightArrow:2192 RightArrowBar:21E5 RightArrowLeftArrow:21C4 RightCeiling:2309
  RightDoubleBracket:27E7 RightDownTeeVector:295D RightDownVector:21C2 RightDownVectorBar:2955
  RightFloor:230B RightTee:22A2 RightTeeArrow:21A6 RightTeeVector:295B RightTriangle:22B3
  RightTriangleBar:29D0 RightTriangleEqual:22B5 RightUpDownVector:294F RightUpTeeVector:295C
  RightUpVector:21BE RightUpVectorBar:2954 RightVector:21C0 RightVectorBar:2953 Rightarrow:21D2
  Ropf:211D RoundImplies:2970 Rrightarrow:21DB Rscr:211B Rsh:21B1 RuleDelayed:29F4 SHCHcy:429
  SHcy:428 SOFTcy:42C Sacute:15A Sc:2ABC Scedil:15E Scirc:15C Scy:421 Sfr:1D516
  ShortDownArrow:2193 ShortLeftArrow:2190 ShortRightArrow:2192 ShortUpArrow:2191 SmallCircle:2218
  Sopf:1D54A Sqrt:221A Square:25A1 SquareIntersection:2293 SquareSubset:228F
  SquareSubsetEqual:2291 SquareSuperset:2290 SquareSupersetEqual:2292 SquareUnion:2294 Sscr:1D4AE
  Star:22C6 Sub:22D0 Subset:22D0 SubsetEqual:2286 Succeeds:227B SucceedsEqual:2AB0
  SucceedsSlantEqual:227D SucceedsTilde:227F SuchThat:220B Sum:2211 Sup:22D1 Superset:2283
  SupersetEqual:2287 Supset:22D1 TRADE:2122 TSHcy:40B TScy:426 Tab:9 Tcaron:164 Tcedil:162 Tcy:422
  Tfr:1D517 Therefore:2234 ThickSpace:205F+200A ThinSpace:2009 Tilde:223C TildeEqual:2243
  TildeFullEqual:2245 TildeTilde:2248 Topf:1D54B TripleDot:20DB Tscr:1D4AF Tstrok:166 Uarr:219F
  Uarrocir:2949 Ubrcy:40E Ubreve:16C Ucy:423 Udblac:170 Ufr:1D518 Umacr:16A UnderBar:5F
  UnderBrace:23DF UnderBracket:23B5 UnderParenthesis:23DD Union:22C3 UnionPlus:228E Uogon:172
  Uopf:1D54C UpArrow:2191 UpArrowBar:2912 UpArrowDownArrow:21C5 UpDownArrow:2195
  UpEquilibrium:296E UpTee:22A5 UpTeeArrow:21A5 Uparrow:21D1 Updownarrow:21D5 UpperLeftArrow:2196
  UpperRightArrow:2197 Upsi:3D2 Uring:16E Uscr:1D4B0 Utilde:168 VDash:22AB Vbar:2AEB Vcy:412
  Vdash:22A9 Vdashl:2AE6 Vee:22C1 Verbar:2016 Vert:2016 VerticalBar:2223 VerticalLine:7C
  VerticalSeparator:2758 VerticalTilde:2240 VeryThinSpace:200A Vfr:1D519 Vopf:1D54D Vscr:1D4B1
  Vvdash:22AA Wcirc:174 Wedge:22C0 Wfr:1D51A Wopf:1D54E Wscr:1D4B2 Xfr:1D51B Xopf:1D54F Xscr:1D4B3
  YAcy:42F YIcy:407 YUcy:42E Ycirc:176 Ycy:42B Yfr:1D51C Yopf:1D550 Yscr:1D4B4 ZHcy:416 Zacute:179
  Zcaron:17D Zcy:417 Zdot:17B ZeroWidthSpace:200B Zfr:2128 Zopf:2124 Zscr:1D4B5 abreve:103 ac:223E
  acE:223E+333 acd:223F acy:430 af:2061 afr:1D51E aleph:2135 amacr:101 amalg:2A3F andand:2A55
  andd:2A5C andslope:2A58 andv:2A5A ange:29A4 angle:2220 angmsd:2221 angmsdaa:29A8 angmsdab:29A9
  angmsdac:29AA angmsdad:29AB angmsdae:29AC angmsdaf:29AD angmsdag:29AE angmsdah:29AF angrt:221F
  angrtvb:22BE angrtvbd:299D angsph:2222 angst:C5 angzarr:237C aogon:105 aopf:1D552 ap:2248
  apE:2A70 apacir:2A6F ape:224A apid:224B approx:2248 approxeq:224A ascr:1D4B6 ast:2A asympeq:224D
  awconint:2233 awint:2A11 bNot:2AED backcong:224C backepsilon:3F6 backprime:2035 backsim:223D
  backsimeq:22CD barvee:22BD barwed:2305 barwedge:2305 bbrk:23B5 bbrktbrk:23B6 bcong:224C bcy:431
  becaus:2235 because:2235 bemptyv:29B0 bepsi:3F6 bernou:212C beth:2136 between:226C bfr:1D51F
  bigcap:22C2 bigcirc:25EF bigcup:22C3 bigodot:2A00 bigoplus:2A01 bigotimes:2A02 bigsqcup:2A06
  bigstar:2605 bigtriangledown:25BD bigtriangleup:25B3 biguplus:2A04 bigvee:22C1 bigwedge:22C0
  bkarow:290D blacklozenge:29EB blacksquare:25AA blacktriangle:25B4 blacktriangledown:25BE
  blacktriangleleft:25C2 blacktriangleright:25B8 blank:2423 blk12:2592 blk14:2591 blk34:2593
  block:2588 bne:3D+20E5 bnequiv:2261+20E5 bnot:2310 bopf:1D553 bot:22A5 bottom:22A5 bowtie:22C8
  boxDL:2557 boxDR:2554 boxDl:2556 boxDr:2553 boxH:2550 boxHD:2566 boxHU:2569 boxHd:2564
  boxHu:2567 boxUL:255D boxUR:255A boxUl:255C boxUr:2559 boxV:2551 boxVH:256C boxVL:2563
  boxVR:2560 boxVh:256B boxVl:2562 boxVr:255F boxbox:29C9 boxdL:2555 boxdR:2552 boxdl:2510
  boxdr:250C boxh:2500 boxhD:2565 boxhU:2568 boxhd:252C boxhu:2534 boxminus:229F boxplus:229E
  boxtimes:22A0 boxuL:255B boxuR:2558 boxul:2518 boxur:2514 boxv:2502 boxvH:256A boxvL:2561
  boxvR:255E boxvh:253C boxvl:2524 boxvr:251C bprime:2035 breve:2D8 bscr:1D4B7 bsemi:204F
  bsim:223D bsime:22CD bsol:5C bsolb:29C5 bsolhsub:27C8 bullet:2022 bump:224E bumpE:2AAE
  bumpe:224F bumpeq:224F cacute:107 capand:2A44 capbrcup:2A49 capcap:2A4B capcup:2A47 capdot:2A40
  caps:2229+FE00 caret:2041 caron:2C7 ccaps:2A4D ccaron:10D ccirc:109 ccups:2A4C ccupssm:2A50
  cdot:10B cemptyv:29B2 centerdot:B7 cfr:1D520 chcy:447 check:2713 checkmark:2713 cir:25CB
  cirE:29C3 circeq:2257 circlearrowleft:21BA circlearrowright:21BB circledR:AE circledS:24C8
  circledast:229B circledcirc:229A circleddash:229D cire:2257 cirfnint:2A10 cirmid:2AEF
  cirscir:29C2 clubsuit:2663 colon:3A colone:2254 coloneq:2254 comma:2C commat:40 comp:2201
  compfn:2218 complement:2201 complexes:2102 congdot:2A6D conint:222E copf:1D554 coprod:2210
  copysr:2117 cross:2717 cscr:1D4B8 csub:2ACF csube:2AD1 csup:2AD0 csupe:2AD2 ctdot:22EF
  cudarrl:2938 cudarrr:2935 cuepr:22DE cuesc:22DF cularr:21B6 cularrp:293D cupbrcap:2A48
  cupcap:2A46 cupcup:2A4A cupdot:228D cupor:2A45 cups:222A+FE00 curarr:21B7 curarrm:293C
  curlyeqprec:22DE curlyeqsucc:22DF curlyvee:22CE curlywedge:22CF curvearrowleft:21B6
  curvearrowright:21B7 cuvee:22CE cuwed:22CF cwconint:2232 cwint:2231 cylcty:232D dHar:2965
  daleth:2138 dash:2010 dashv:22A3 dbkarow:290F dblac:2DD dcaron:10F dcy:434 dd:2146 ddagger:2021
  ddarr:21CA ddotseq:2A77 demptyv:29B1 dfisht:297F dfr:1D521 dharl:21C3 dharr:21C2 diam:22C4
  diamond:22C4 diamondsuit:2666 die:A8 digamma:3DD disin:22F2 div:F7 divideontimes:22C7
  divonx:22C7 djcy:452 dlcorn:231E dlcrop:230D dollar:24 dopf:1D555 dot:2D9 doteq:2250
  doteqdot:2251 dotminus:2238 dotplus:2214 dotsquare:22A1 doublebarwedge:2306 downarrow:2193
  downdownarrows:21CA downharpoonleft:21C3 downharpoonright:21C2 drbkarow:2910 drcorn:231F
  drcrop:230C dscr:1D4B9 dscy:455 dsol:29F6 dstrok:111 dtdot:22F1 dtri:25BF dtrif:25BE duarr:21F5
  duhar:296F dwangle:29A6 dzcy:45F dzigrarr:27FF eDDot:2A77 eDot:2251 easter:2A6E ecaron:11B
  ecir:2256 ecolon:2255 ecy:44D edot:117 ee:2147 efDot:2252 efr:1D522 eg:2A9A egs:2A96 egsdot:2A98
  el:2A99 elinters:23E7 ell:2113 els:2A95 elsdot:2A97 emacr:113 emptyset:2205 emptyv:2205
  emsp13:2004 emsp14:2005 eng:14B eogon:119 eopf:1D556 epar:22D5 eparsl:29E3 eplus:2A71 epsi:3B5
  epsiv:3F5 eqcirc:2256 eqcolon:2255 eqsim:2242 eqslantgtr:2A96 eqslantless:2A95 equals:3D
  equest:225F equivDD:2A78 eqvparsl:29E5 erDot:2253 erarr:2971 escr:212F esdot:2250 esim:2242
  excl:21 expectation:2130 exponentiale:2147 fallingdotseq:2252 fcy:444 female:2640 ffilig:FB03
  fflig:FB00 ffllig:FB04 ffr:1D523 filig:FB01 fjlig:66+6A flat:266D fllig:FB02 fltns:25B1
  fopf:1D557 fork:22D4 forkv:2AD9 fpartint:2A0D frac13:2153 frac15:2155 frac16:2159 frac18:215B
  frac23:2154 frac25:2156 frac35:2157 frac38:215C frac45:2158 frac56:215A frac58:215D frac78:215E
  frown:2322 fscr:1D4BB gE:2267 gEl:2A8C gacute:1F5 gammad:3DD gap:2A86 gbreve:11F gcirc:11D
  gcy:433 gdot:121 gel:22DB geq:2265 geqq:2267 geqslant:2A7E ges:2A7E gescc:2AA9 gesdot:2A80
  gesdoto:2A82 gesdotol:2A84 gesl:22DB+FE00 gesles:2A94 gfr:1D524 gg:226B ggg:22D9 gimel:2137
  gjcy:453 gl:2277 glE:2A92 gla:2AA5 glj:2AA4 gnE:2269 gnap:2A8A gnapprox:2A8A gne:2A88 gneq:2A88
  gneqq:2269 gnsim:22E7 gopf:1D558 grave:60 gscr:210A gsim:2273 gsime:2A8E gsiml:2A90 gtcc:2AA7
  gtcir:2A7A gtdot:22D7 gtlPar:2995 gtquest:2A7C gtrapprox:2A86 gtrarr:2978 gtrdot:22D7
  gtreqless:22DB gtreqqless:2A8C gtrless:2277 gtrsim:2273 gvertneqq:2269+FE00 gvnE:2269+FE00
  hairsp:200A half:BD hamilt:210B hardcy:44A harrcir:2948 harrw:21AD hbar:210F hcirc:125
  heartsuit:2665 hercon:22B9 hfr:1D525 hksearow:2925 hkswarow:2926 hoarr:21FF homtht:223B
  hookleftarrow:21A9 hookrightarrow:21AA hopf:1D559 horbar:2015 hscr:1D4BD hslash:210F hstrok:127
  hybull:2043 hyphen:2010 ic:2063 icy:438 iecy:435 iff:21D4 ifr:1D526 ii:2148 iiiint:2A0C
  iiint:222D iinfin:29DC iiota:2129 ijlig:133 imacr:12B imagline:2110 imagpart:2111 imath:131
  imof:22B7 imped:1B5 in:2208 incare:2105 infintie:29DD inodot:131 intcal:22BA integers:2124
  intercal:22BA intlarhk:2A17 intprod:2A3C iocy:451 iogon:12F iopf:1D55A iprod:2A3C iscr:1D4BE
  isinE:22F9 isindot:22F5 isins:22F4 isinsv:22F3 isinv:2208 it:2062 itilde:129 iukcy:456 jcirc:135
  jcy:439 jfr:1D527 jmath:237 jopf:1D55B jscr:1D4BF jsercy:458 jukcy:454 kappav:3F0 kcedil:137
  kcy:43A kfr:1D528 kgreen:138 khcy:445 kjcy:45C kopf:1D55C kscr:1D4C0 lAarr:21DA lAtail:291B
  lBarr:290E lE:2266 lEg:2A8B lHar:2962 lacute:13A laemptyv:29B4 lagran:2112 langd:2991
  langle:27E8 lap:2A85 larrb:21E4 larrbfs:291F larrfs:291D larrhk:21A9 larrlp:21AB larrpl:2939
  larrsim:2973 larrtl:21A2 lat:2AAB latail:2919 late:2AAD lates:2AAD+FE00 lbarr:290C lbbrk:2772
  lbrace:7B lbrack:5B lbrke:298B lbrksld:298F lbrkslu:298D lcaron:13E lcedil:13C lcub:7B lcy:43B
  ldca:2936 ldquor:201E ldrdhar:2967 ldrushar:294B ldsh:21B2 leftarrow:2190 leftarrowtail:21A2
  leftharpoondown:21BD leftharpoonup:21BC leftleftarrows:21C7 leftrightarrow:2194
  leftrightarrows:21C6 leftrightharpoons:21CB leftrightsquigarrow:21AD leftthreetimes:22CB
  leg:22DA leq:2264 leqq:2266 leqslant:2A7D les:2A7D lescc:2AA8 lesdot:2A7F lesdoto:2A81
  lesdotor:2A83 lesg:22DA+FE00 lesges:2A93 lessapprox:2A85 lessdot:22D6 lesseqgtr:22DA
  lesseqqgtr:2A8B lessgtr:2276 lesssim:2272 lfisht:297C lfr:1D529 lg:2276 lgE:2A91 lhard:21BD
  lharu:21BC lharul:296A lhblk:2584 ljcy:459 ll:226A llarr:21C7 llcorner:231E llhard:296B
  lltri:25FA lmidot:140 lmoust:23B0 lmoustache:23B0 lnE:2268 lnap:2A89 lnapprox:2A89 lne:2A87
  lneq:2A87 lneqq:2268 lnsim:22E6 loang:27EC loarr:21FD lobrk:27E6 longleftarrow:27F5
  longleftrightarrow:27F7 longmapsto:27FC longrightarrow:27F6 looparrowleft:21AB
  looparrowright:21AC lopar:2985 lopf:1D55D loplus:2A2D lotimes:2A34 lowbar:5F lozenge:25CA
  lozf:29EB lpar:28 lparlt:2993 lrarr:21C6 lrcorner:231F lrhar:21CB lrhard:296D lrtri:22BF
  lscr:1D4C1 lsh:21B0 lsim:2272 lsime:2A8D lsimg:2A8F lsqb:5B lsquor:201A lstrok:142 ltcc:2AA6
  ltcir:2A79 ltdot:22D6 lthree:22CB ltimes:22C9 ltlarr:2976 ltquest:2A7B ltrPar:2996 ltri:25C3
  ltrie:22B4 ltrif:25C2 lurdshar:294A luruhar:2966 lvertneqq:2268+FE00 lvnE:2268+FE00 mDDot:223A
  male:2642 malt:2720 maltese:2720 map:21A6 mapsto:21A6 mapstodown:21A7 mapstoleft:21A4
  mapstoup:21A5 marker:25AE mcomma:2A29 mcy:43C measuredangle:2221 mfr:1D52A mho:2127 mid:2223
  midast:2A midcir:2AF0 minusb:229F minusd:2238 minusdu:2A2A mlcp:2ADB mldr:2026 mnplus:2213
  models:22A7 mopf:1D55E mp:2213 mscr:1D4C2 mstpos:223E multimap:22B8 mumap:22B8 nGg:22D9+338
  nGt:226B+20D2 nGtv:226B+338 nLeftarrow:21CD nLeftrightarrow:21CE nLl:22D8+338 nLt:226A+20D2
  nLtv:226A+338 nRightarrow:21CF nVDash:22AF nVdash:22AE nacute:144 nang:2220+20D2 nap:2249
  napE:2A70+338 napid:224B+338 napos:149 napprox:2249 natur:266E natural:266E naturals:2115
  nbump:224E+338 nbumpe:224F+338 ncap:2A43 ncaron:148 ncedil:146 ncong:2247 ncongdot:2A6D+338
  ncup:2A42 ncy:43D neArr:21D7 nearhk:2924 nearr:2197 nearrow:2197 nedot:2250+338 nequiv:2262
  nesear:2928 nesim:2242+338 nexist:2204 nexists:2204 nfr:1D52B ngE:2267+338 nge:2271 ngeq:2271
  ngeqq:2267+338 ngeqslant:2A7E+338 nges:2A7E+338 ngsim:2275 ngt:226F ngtr:226F nhArr:21CE
  nharr:21AE nhpar:2AF2 nis:22FC nisd:22FA niv:220B njcy:45A nlArr:21CD nlE:2266+338 nlarr:219A
  nldr:2025 nle:2270 nleftarrow:219A nleftrightarrow:21AE nleq:2270 nleqq:2266+338
  nleqslant:2A7D+338 nles:2A7D+338 nless:226E nlsim:2274 nlt:226E nltri:22EA nltrie:22EC nmid:2224
  nopf:1D55F notinE:22F9+338 notindot:22F5+338 notinva:2209 notinvb:22F7 notinvc:22F6 notni:220C
  notniva:220C notnivb:22FE notnivc:22FD npar:2226 nparallel:2226 nparsl:2AFD+20E5 npart:2202+338
  npolint:2A14 npr:2280 nprcue:22E0 npre:2AAF+338 nprec:2280 npreceq:2AAF+338 nrArr:21CF
  nrarr:219B nrarrc:2933+338 nrarrw:219D+338 nrightarrow:219B nrtri:22EB nrtrie:22ED nsc:2281
  nsccue:22E1 nsce:2AB0+338 nscr:1D4C3 nshortmid:2224 nshortparallel:2226 nsim:2241 nsime:2244
  nsimeq:2244 nsmid:2224 nspar:2226 nsqsube:22E2 nsqsupe:22E3 nsubE:2AC5+338 nsube:2288
  nsubset:2282+20D2 nsubseteq:2288 nsubseteqq:2AC5+338 nsucc:2281 nsucceq:2AB0+338 nsup:2285
  nsupE:2AC6+338 nsupe:2289 nsupset:2283+20D2 nsupseteq:2289 nsupseteqq:2AC6+338 ntgl:2279
  ntlg:2278 ntriangleleft:22EA ntrianglelefteq:22EC ntriangleright:22EB ntrianglerighteq:22ED
  num:23 numero:2116 numsp:2007 nvDash:22AD nvHarr:2904 nvap:224D+20D2 nvdash:22AC nvge:2265+20D2
  nvgt:3E+20D2 nvinfin:29DE nvlArr:2902 nvle:2264+20D2 nvlt:3C+20D2 nvltrie:22B4+20D2 nvrArr:2903
  nvrtrie:22B5+20D2 nvsim:223C+20D2 nwArr:21D6 nwarhk:2923 nwarr:2196 nwarrow:2196 nwnear:2927
  oS:24C8 oast:229B ocir:229A ocy:43E odash:229D odblac:151 odiv:2A38 odot:2299 odsold:29BC
  ofcir:29BF ofr:1D52C ogon:2DB ogt:29C1 ohbar:29B5 ohm:3A9 oint:222E olarr:21BA olcir:29BE
  olcross:29BB olt:29C0 omacr:14D omid:29B6 ominus:2296 oopf:1D560 opar:29B7 operp:29B9 orarr:21BB
  ord:2A5D order:2134 orderof:2134 origof:22B6 oror:2A56 orslope:2A57 orv:2A5B oscr:2134 osol:2298
  otimesas:2A36 ovbar:233D par:2225 parallel:2225 parsim:2AF3 parsl:2AFD pcy:43F percnt:25
  period:2E pertenk:2031 pfr:1D52D phiv:3D5 phmmat:2133 phone:260E pitchfork:22D4 planck:210F
  planckh:210E plankv:210F plus:2B plusacir:2A23 plusb:229E pluscir:2A22 plusdo:2214 plusdu:2A25
  pluse:2A72 plussim:2A26 plustwo:2A27 pm:B1 pointint:2A15 popf:1D561 pr:227A prE:2AB3 prap:2AB7
  prcue:227C pre:2AAF prec:227A precapprox:2AB7 preccurlyeq:227C preceq:2AAF precnapprox:2AB9
  precneqq:2AB5 precnsim:22E8 precsim:227E primes:2119 prnE:2AB5 prnap:2AB9 prnsim:22E8
  profalar:232E profline:2312 profsurf:2313 propto:221D prsim:227E prurel:22B0 pscr:1D4C5
  puncsp:2008 qfr:1D52E qint:2A0C qopf:1D562 qprime:2057 qscr:1D4C6 quaternions:210D quatint:2A16
  quest:3F questeq:225F rAarr:21DB rAtail:291C rBarr:290F rHar:2964 race:223D+331 racute:155
  raemptyv:29B3 rangd:2992 range:29A5 rangle:27E9 rarrap:2975 rarrb:21E5 rarrbfs:2920 rarrc:2933
  rarrfs:291E rarrhk:21AA rarrlp:21AC rarrpl:2945 rarrsim:2974 rarrtl:21A3 rarrw:219D ratail:291A
  ratio:2236 rationals:211A rbarr:290D rbbrk:2773 rbrace:7D rbrack:5D rbrke:298C rbrksld:298E
  rbrkslu:2990 rcaron:159 rcedil:157 rcub:7D rcy:440 rdca:2937 rdldhar:2969 rdquor:201D rdsh:21B3
  realine:211B realpart:211C reals:211D rect:25AD rfisht:297D rfr:1D52F rhard:21C1 rharu:21C0
  rharul:296C rhov:3F1 rightarrow:2192 rightarrowtail:21A3 rightharpoondown:21C1
  rightharpoonup:21C0 rightleftarrows:21C4 rightleftharpoons:21CC rightrightarrows:21C9
  rightsquigarrow:219D rightthreetimes:22CC ring:2DA risingdotseq:2253 rlarr:21C4 rlhar:21CC
  rmoust:23B1 rmoustache:23B1 rnmid:2AEE roang:27ED roarr:21FE robrk:27E7 ropar:2986 ropf:1D563
  roplus:2A2E rotimes:2A35 rpar:29 rpargt:2994 rppolint:2A12 rrarr:21C9 rscr:1D4C7 rsh:21B1
  rsqb:5D rsquor:2019 rthree:22CC rtimes:22CA rtri:25B9 rtrie:22B5 rtrif:25B8 rtriltri:29CE
  ruluhar:2968 rx:211E sacute:15B sc:227B scE:2AB4 scap:2AB8 sccue:227D sce:2AB0 scedil:15F
  scirc:15D scnE:2AB6 scnap:2ABA scnsim:22E9 scpolint:2A13 scsim:227F scy:441 sdotb:22A1
  sdote:2A66 seArr:21D8 searhk:2925 searr:2198 searrow:2198 semi:3B seswar:2929 setminus:2216
  setmn:2216 sext:2736 sfr:1D530 sfrown:2322 sharp:266F shchcy:449 shcy:448 shortmid:2223
  shortparallel:2225 sigmav:3C2 simdot:2A6A sime:2243 simeq:2243 simg:2A9E simgE:2AA0 siml:2A9D
  simlE:2A9F simne:2246 simplus:2A24 simrarr:2972 slarr:2190 smallsetminus:2216 smashp:2A33
  smeparsl:29E4 smid:2223 smile:2323 smt:2AAA smte:2AAC smtes:2AAC+FE00 softcy:44C sol:2F
  solb:29C4 solbar:233F sopf:1D564 spadesuit:2660 spar:2225 sqcap:2293 sqcaps:2293+FE00 sqcup:2294
  sqcups:2294+FE00 sqsub:228F sqsube:2291 sqsubset:228F sqsubseteq:2291 sqsup:2290 sqsupe:2292
  sqsupset:2290 sqsupseteq:2292 squ:25A1 square:25A1 squarf:25AA squf:25AA srarr:2192 sscr:1D4C8
  ssetmn:2216 ssmile:2323 sstarf:22C6 star:2606 starf:2605 straightepsilon:3F5 straightphi:3D5
  strns:AF subE:2AC5 subdot:2ABD subedot:2AC3 submult:2AC1 subnE:2ACB subne:228A subplus:2ABF
  subrarr:2979 subset:2282 subseteq:2286 subseteqq:2AC5 subsetneq:228A subsetneqq:2ACB subsim:2AC7
  subsub:2AD5 subsup:2AD3 succ:227B succapprox:2AB8 succcurlyeq:227D succeq:2AB0 succnapprox:2ABA
  succneqq:2AB6 succnsim:22E9 succsim:227F sung:266A supE:2AC6 supdot:2ABE supdsub:2AD8
  supedot:2AC4 suphsol:27C9 suphsub:2AD7 suplarr:297B supmult:2AC2 supnE:2ACC supne:228B
  supplus:2AC0 supset:2283 supseteq:2287 supseteqq:2AC6 supsetneq:228B supsetneqq:2ACC supsim:2AC8
  supsub:2AD4 supsup:2AD6 swArr:21D9 swarhk:2926 swarr:2199 swarrow:2199 swnwar:292A target:2316
  tbrk:23B4 tcaron:165 tcedil:163 tcy:442 tdot:20DB telrec:2315 tfr:1D531 therefore:2234
  thetav:3D1 thickapprox:2248 thicksim:223C thkap:2248 thksim:223C timesb:22A0 timesbar:2A31
  timesd:2A30 tint:222D toea:2928 top:22A4 topbot:2336 topcir:2AF1 topf:1D565 topfork:2ADA
  tosa:2929 tprime:2034 triangle:25B5 triangledown:25BF triangleleft:25C3 trianglelefteq:22B4
  triangleq:225C triangleright:25B9 trianglerighteq:22B5 tridot:25EC trie:225C triminus:2A3A
  triplus:2A39 trisb:29CD tritime:2A3B trpezium:23E2 tscr:1D4C9 tscy:446 tshcy:45B tstrok:167
  twixt:226C twoheadleftarrow:219E twoheadrightarrow:21A0 uHar:2963 ubrcy:45E ubreve:16D ucy:443
  udarr:21C5 udblac:171 udhar:296E ufisht:297E ufr:1D532 uharl:21BF uharr:21BE uhblk:2580
  ulcorn:231C ulcorner:231C ulcrop:230F ultri:25F8 umacr:16B uogon:173 uopf:1D566 uparrow:2191
  updownarrow:2195 upharpoonleft:21BF upharpoonright:21BE uplus:228E upsi:3C5 upuparrows:21C8
  urcorn:231D urcorner:231D urcrop:230E uring:16F urtri:25F9 uscr:1D4CA utdot:22F0 utilde:169
  utri:25B5 utrif:25B4 uuarr:21C8 uwangle:29A7 vArr:21D5 vBar:2AE8 vBarv:2AE9 vDash:22A8
  vangrt:299C varepsilon:3F5 varkappa:3F0 varnothing:2205 varphi:3D5 varpi:3D6 varpropto:221D
  varr:2195 varrho:3F1 varsigma:3C2 varsubsetneq:228A+FE00 varsubsetneqq:2ACB+FE00
  varsupsetneq:228B+FE00 varsupsetneqq:2ACC+FE00 vartheta:3D1 vartriangleleft:22B2
  vartriangleright:22B3 vcy:432 vdash:22A2 vee:2228 veebar:22BB veeeq:225A vellip:22EE verbar:7C
  vert:7C vfr:1D533 vltri:22B2 vnsub:2282+20D2 vnsup:2283+20D2 vopf:1D567 vprop:221D vrtri:22B3
  vscr:1D4CB vsubnE:2ACB+FE00 vsubne:228A+FE00 vsupnE:2ACC+FE00 vsupne:228B+FE00 vzigzag:299A
  wcirc:175 wedbar:2A5F wedge:2227 wedgeq:2259 wfr:1D534 wopf:1D568 wp:2118 wr:2240 wreath:2240
  wscr:1D4CC xcap:22C2 xcirc:25EF xcup:22C3 xdtri:25BD xfr:1D535 xhArr:27FA xharr:27F7 xlArr:27F8
  xlarr:27F5 xmap:27FC xnis:22FB xodot:2A00 xopf:1D569 xoplus:2A01 xotime:2A02 xrArr:27F9
  xrarr:27F6 xscr:1D4CD xsqcup:2A06 xuplus:2A04 xutri:25B3 xvee:22C1 xwedge:22C0 yacy:44F
  ycirc:177 ycy:44B yfr:1D536 yicy:457 yopf:1D56A yscr:1D4CE yucy:44E zacute:17A zcaron:17E
  zcy:437 zdot:17C zeetrf:2128 zfr:1D537 zhcy:436 zigrarr:21DD zopf:1D56B zscr:1D4CF
`;

/** HTML's named character references that JSX does not decode, by name, with their text. */
export const HTML_ONLY_ENTITIES: ReadonlyMap<string, string> = new Map(
  LIST.split(/\s+/)
    .filter(Boolean)
    .map((entry) => {
      const [name, codePoints] = entry.split(":") as [string, string];
      return [
        name,
        String.fromCodePoint(...codePoints.split("+").map((hex) => Number.parseInt(hex, 16))),
      ];
    }),
);
