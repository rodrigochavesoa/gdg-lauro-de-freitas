# Inventário S1-02 — `favicons_package` aninhado

**Data:** 2026-08-15  
**Método:** `Get-FileHash -Algorithm SHA256` em PowerShell (`pwsh`), sem WSL.

## Decisão

A pasta aninhada `docs/design-system/referencias/favicons_package/favicons_package/` é **cópia idêntica** da pasta pai (mesmos 9 arquivos e mesmos SHA-256). Nenhum HTML, CSS, JSX ou manifest de runtime aponta para esse caminho. Os ícones em uso vêm de `public/` (`/favicon.svg`, `/favicon-32x32.png`, `/apple-touch-icon.png`, `/site.webmanifest`, `/icon-192.png`, `/icon-512.png`).

**Ação:** remover somente a pasta aninhada. `public/` e a pasta pai permanecem intactos.

**Revisão Tech Lead:** aprovada em 2026-08-15. Pasta aninhada removida; `public/` e pasta pai intactos; qualidade verde no `pwsh`.

## Pasta aninhada vs pasta pai

Conjuntos iguais. Nenhum arquivo exclusivo.

| Arquivo | SHA-256 | Idêntica à pai |
|---|---|---|
| `android-chrome-192x192.png` | `8427B4CF73D2C93CC4055AB24CD0F812418F4341D7326B56349CB93439FFB513` | sim |
| `android-chrome-512x512.png` | `C3B01916595130DC2312314606AE81B8EA89049E05B38D863B7F4F0D2CB56424` | sim |
| `apple-touch-icon.png` | `DA8783D86F901ED0BCC3D769582D73466C4173689DA9CD959CB19555F64D8B4D` | sim |
| `favicon-16x16.png` | `3C520859C684BADBFEBF4AACAC4CAE5639976ED7D3097A55CF097F6BBEE43E23` | sim |
| `favicon-32x32.png` | `DCCE8E82304A131B1DD625D3380E625DA7FEEBAC8B9F87F137C219CB80FE387F` | sim |
| `favicon-48x48.png` | `82281D5B2C18888BA211C80538DA95FAE4228EDEB398BE9918A873743567E590` | sim |
| `favicon.ico` | `98558086E12D017038B9171C87A12391591A570136FF54551BD4B69F26897178` | sim |
| `favicon.svg` | `862FEC075F891245579B0248A2B370A295710C2646A5DC62F1422E9ECBF9CFFF` | sim |
| `site.webmanifest` | `4946B27F0E2D4FAA3567322950116F22E026DE5C4A7BAA536A0BFE560B46A15E` | sim |

## Pasta aninhada vs `public/`

Nomes parecidos **não** são o mesmo arquivo. `public/` não deve ser alterado.

| Nome | SHA-256 aninhada | SHA-256 `public/` | Idêntica |
|---|---|---|---|
| `apple-touch-icon.png` | `DA8783D8…4D8B4D` | `11973839BC4DC14B08A7DA60FAAF12A3425CCB24292A983A8B4849C3B21760D2` | não |
| `favicon-32x32.png` | `DCCE8E82…FE387F` | `B75B7349B4BCFFB05866753CAC031C86D9B0D8466DE1E585CB71E8FF34688BFB` | não |
| `favicon.svg` | `862FEC07…F9CFFF` | `F9AF87FC3C43FA3E3C6B64FAB22E95C964DD2A378932CA35405B7925DA0F225E` | não |
| `site.webmanifest` | `4946B27F…46A15E` | `9E549D08699F378012F585D9CEA21D0CC77153D61F31E1A75158D2777E477498` | não |

Arquivos só em `public/` (runtime): `browserconfig.xml`, `gdg-jobs-dynamic-brand.svg`, `google-icon.svg`, `icon-192.png`, `icon-512.png`, `login-gdg-illustration.svg`.

Arquivos só no pacote de referência: `android-chrome-192x192.png`, `android-chrome-512x512.png`, `favicon-16x16.png`, `favicon-48x48.png`, `favicon.ico`.

## Referências de runtime

| Origem | Caminho usado |
|---|---|
| `index.html` | `/favicon.svg`, `/favicon-32x32.png`, `/apple-touch-icon.png`, `/site.webmanifest`, `/browserconfig.xml` |
| `src/App.jsx` | `/favicon.svg` |
| `public/site.webmanifest` | `/icon-192.png`, `/icon-512.png`, `/favicon.svg` |

Nenhuma referência a `docs/design-system/referencias/favicons_package/favicons_package/`.
