# Changelog

## [0.3.0](https://github.com/pedrofuentes/gitnotate/compare/browser-v0.2.0...browser-v0.3.0) (2026-06-30)


### Features

* **browser-extension:** dynamic status badge and auto-reload on style change ([28650ab](https://github.com/pedrofuentes/gitnotate/commit/28650abc114f4864dd9a778890eb50bc05ceb3a6))
* **browser-extension:** dynamic status badge and auto-reload on style change ([4cc772b](https://github.com/pedrofuentes/gitnotate/commit/4cc772b9f8614e3ce8764149e7176ff9e6a35699))
* **browser-extension:** redesign opt-in banner as floating notification card ([a7b823b](https://github.com/pedrofuentes/gitnotate/commit/a7b823b6e37e58892d6c9e08d6f2f8394a05b765))
* **browser-extension:** redesign opt-in banner as floating notification card ([f46a057](https://github.com/pedrofuentes/gitnotate/commit/f46a057617463cfe94e5f097df94fb47d69dcc3f))
* **browser-extension:** redesign popup with dark theme and visual style picker ([92af1ec](https://github.com/pedrofuentes/gitnotate/commit/92af1ecd1c5d55a0d0a7f6dff4a5ef86ed6bad5e))
* **browser-extension:** redesign popup with dark theme and visual style picker ([3fce770](https://github.com/pedrofuentes/gitnotate/commit/3fce770c13044e0d0b87a88aee95718fab947690))
* **browser-extension:** refine status badge to 5 contextual states ([909c052](https://github.com/pedrofuentes/gitnotate/commit/909c05235e046a55518e26761ce48dd5f17dda00))
* **browser-extension:** refine status badge to 5 contextual states ([4d43402](https://github.com/pedrofuentes/gitnotate/commit/4d43402242c4bb1c1f2511c524fd22cc6436eaae))
* **browser:** add conversation-view comment processing ([9296240](https://github.com/pedrofuentes/gitnotate/commit/92962407abe936b29501a90eedf932ecc0ba5387))
* **browser:** conversation-view comment processing ([d29f6d4](https://github.com/pedrofuentes/gitnotate/commit/d29f6d4442058c6a0c98196c268548c512fb5887))


### Bug Fixes

* **browser-extension:** add 16px transparent padding to 128px icon ([c1a2c99](https://github.com/pedrofuentes/gitnotate/commit/c1a2c99f64498d4a27c8441156be5867f317b73a))
* **browser-extension:** add 16px transparent padding to 128px icon ([a4ab226](https://github.com/pedrofuentes/gitnotate/commit/a4ab2264f406a49620cf2fb90000e542d0e2799b))
* **browser-extension:** reload page and refresh status on repo changes ([4539b89](https://github.com/pedrofuentes/gitnotate/commit/4539b89da55ecf08f03d828a17254dd18d7acedc))
* **browser-extension:** reload page and refresh status on repo changes ([ecbfb7e](https://github.com/pedrofuentes/gitnotate/commit/ecbfb7e3940f9b3c8cafe2a77c355e5e0a2c8947))
* **browser-extension:** resolve Sentinel critical findings ([a7ee592](https://github.com/pedrofuentes/gitnotate/commit/a7ee5921e194b7b4a4a2ba6bc1ad685d114d6f71))
* **browser-extension:** resolve Sentinel critical findings ([93339c9](https://github.com/pedrofuentes/gitnotate/commit/93339c90ee95776da244890fbbec3a19abfcfb40))
* **ci:** add @types/chrome for browser extension typecheck ([0737424](https://github.com/pedrofuentes/gitnotate/commit/07374248c77f41007d3064942eb4a029a8829bca))
* **ci:** add @types/chrome for browser extension typecheck ([7842ba5](https://github.com/pedrofuentes/gitnotate/commit/7842ba56dba7a0524d4d20873f1c9e95e6b693c1))
* **ci:** resolve pre-existing typecheck errors ([c21dded](https://github.com/pedrofuentes/gitnotate/commit/c21dded05a0e97f3984583672b073f2d9f6b51c6))
* **ci:** resolve pre-existing typecheck errors ([e704065](https://github.com/pedrofuentes/gitnotate/commit/e704065ad7ee326145a93de8fb0fabaa5da78950))
* **docs:** correct ^gn metadata tag format to ^gn:LINE:START:END ([d854abf](https://github.com/pedrofuentes/gitnotate/commit/d854abf19a91d2ac5159d8ee09416215225885ee))
* **docs:** correct ^gn metadata tag format to ^gn:LINE:START:END ([fa9476f](https://github.com/pedrofuentes/gitnotate/commit/fa9476f5903ebbdc4a9a6e3cc40b93bd62dad3a2))
* **error-handling:** add error logging, retry logic, scope validation, and storage guards ([76d9437](https://github.com/pedrofuentes/gitnotate/commit/76d94370f9aa21ccce6f079755e8d817b38bf9a4))
* **error-handling:** add error logging, retry logic, scope validation, and storage guards ([5e00b1f](https://github.com/pedrofuentes/gitnotate/commit/5e00b1fd865507215c3864dac37786604be3c92e))
* **github-selectors:** add hash-resilient fallback selectors for GitHub CSS modules ([22bee04](https://github.com/pedrofuentes/gitnotate/commit/22bee04d6f2926e71d987e6e5a1a60965def161a))
* **github-selectors:** add hash-resilient fallback selectors for GitHub CSS modules ([6e4a0fd](https://github.com/pedrofuentes/gitnotate/commit/6e4a0fddd4227f16de49c1b0defa0d826ede9748))
* **highlighter:** use JS filtering instead of incomplete CSS escaping in clearHighlight ([c1d4535](https://github.com/pedrofuentes/gitnotate/commit/c1d45357bb1596423eaa93b0ebc55d36eaac0c8a))
* **highlighter:** use JS filtering instead of incomplete CSS escaping in clearHighlight ([5046703](https://github.com/pedrofuentes/gitnotate/commit/5046703809483a8d7b1250aa8025b422a16a4372))
* **network:** add fetch timeouts, rate limit handling, and parallel sidecar processing ([304b5ff](https://github.com/pedrofuentes/gitnotate/commit/304b5ff9cdb8ba793de2e217df38324685d778a5))
* **network:** add fetch timeouts, rate limit handling, and parallel sidecar processing ([04f7308](https://github.com/pedrofuentes/gitnotate/commit/04f7308abe5da44f73181df6694049eaec4400d6))
* **sidecar-client:** harden sidecar operations against edge cases ([9f62b15](https://github.com/pedrofuentes/gitnotate/commit/9f62b15232af5730673cac27bfb62168f664b7ce))
* **sidecar-client:** harden sidecar operations against edge cases ([0dd419d](https://github.com/pedrofuentes/gitnotate/commit/0dd419d719e2fd3cef5a7bef8924a23f0fe1bdea))
* **test:** resolve merge conflict between retry logic and network error tests ([7b2004c](https://github.com/pedrofuentes/gitnotate/commit/7b2004cf30450cc5f71d6de1b71c6caf299b4415))
* **test:** resolve merge conflict between retry logic and network error tests ([743975e](https://github.com/pedrofuentes/gitnotate/commit/743975e0cf5f8dd6acb94063bb3737c9bdf4235f))
