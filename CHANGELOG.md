# [1.4.0](https://github.com/niklasschaeffer/twitch-channel-miner-v3/compare/v1.3.3...v1.4.0) (2026-09-09)


### Features

* show follow and subscription tier badges next to streamers and in active IRC chat ([5e24e98](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/5e24e9841d68befbd80642972b80d9e3a91b6bf8))

## [1.3.3](https://github.com/niklasschaeffer/twitch-channel-miner-v3/compare/v1.3.2...v1.3.3) (2026-09-09)


### Bug Fixes

* remove green chroma fringe from logo edges ([3d064e1](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/3d064e1c10bcfee0d2bb6aca82ba256f61a44790))

## [1.3.2](https://github.com/niklasschaeffer/twitch-channel-miner-v3/compare/v1.3.1...v1.3.2) (2026-09-09)


### Bug Fixes

* regenerate logo with clean alpha via chroma key ([5e6b73d](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/5e6b73d73847020764809aaea98a44faa4bb6a3f))

## [1.3.1](https://github.com/niklasschaeffer/twitch-channel-miner-v3/compare/v1.3.0...v1.3.1) (2026-09-09)


### Bug Fixes

* transparent background for logo and navbar icon ([5e2e39e](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/5e2e39e2dc636e053d75113fcadf1795ede9119a))

# [1.3.0](https://github.com/niklasschaeffer/twitch-channel-miner-v3/compare/v1.2.0...v1.3.0) (2026-09-09)


### Features

* add minimal footer with github and package links ([86fb18b](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/86fb18b2c8a9da5ed773e63d1475a58af5b29f86))

# [1.2.0](https://github.com/niklasschaeffer/twitch-channel-miner-v3/compare/v1.1.0...v1.2.0) (2026-09-09)


### Bug Fixes

* restore og:type and twitter:card metas ([32b1d72](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/32b1d72dcc0934c9e306578ba56ad10714b4ddde))


### Features

* use generated chest logo in navbar ([8a3b04b](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/8a3b04b6b73643f67957dc1f49086117597c71b8))

# [1.1.0](https://github.com/niklasschaeffer/twitch-channel-miner-v3/compare/v1.0.0...v1.1.0) (2026-09-09)


### Features

* add favicon and unraid logo assets ([849d253](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/849d253bcdd1c2d888aba14470791ad87bc3c774))

# 1.0.0 (2026-09-08)


### Bug Fixes

* **analytics:** record real watch earnings per channel, dedupe claims ([3d5deac](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/3d5deac7117a4697e88d63ce389de3d2c367c44c))
* **auth:** gate dashboard behind login, strip password from user JSON ([ed9a464](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/ed9a46489d4cf0fa61e1f5f6ce1165e5c7b3cb8d))
* **auth:** global API gate and logout endpoint ([35c7295](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/35c72951a2108e271ba7e71556b56f61b66e7df6))
* **auth:** wire AuthModal to onLoginSuccess/onLogout props ([d4bc078](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/d4bc078687953d70ec6afa56f13aaef95c3e5c63))
* **compose:** move dev.db bind mount into volumes section ([828d7c3](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/828d7c3411bf43fbab460da3aa7b38b132c60b0a))
* **i18n:** testClaim labels reflect real claiming ('Claim Bonus Chest' / 'Bonus-Truhe einfordern') ([28fa7a0](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/28fa7a0ae0f7111175ced8dca8d547a036c22990))
* **miner:** anchor chest countdown to per-stream watch progress ([f2e7167](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/f2e7167f45e251853236fbda071949cc49999d37))
* **miner:** clear snapshot interval before re-setting on PubSub reconnect ([1912a27](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/1912a271a7c0d37e83dde66b2de1a634953ba1f1))
* **miner:** per-channel balance baselines — both slots now sync ([85a27e0](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/85a27e0d0641232f3e100dd87d2c846ef0f19334))
* **miner:** preserve authLoginName across PubSub reconnects ([113a6a1](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/113a6a109c584e752479146f62336d4579159180))
* **miner:** real claims now update counters and analytics history ([4962bc3](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/4962bc3c74933c7495c632622bdbfdc8353d9fca))
* **miner:** stop fabricating earnings and connection state ([6747721](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/6747721ed9c7bbbd67bd27536bddbe684aa19009))
* **ui:** dark-mode option styling for all settings selects ([3991150](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/39911501e9762fcdf9236cd355c1cef854a8d7aa))
* **ui:** header cleanup + translation key audit; reset simulated analytics history ([52cea6d](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/52cea6db8f5a9f4d9b494d5c4a31aa6d5d148e8e))
* **ui:** make chat card channel selector horizontally scrollable ([f6c4810](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/f6c4810504e4e81dee54f87d325f3349a8d1d4b5))
* **ui:** missing streamersList labels + strategy dropdown dark-mode contrast ([a7f2bb1](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/a7f2bb147fb0f489d7568bab52a3768573265e8d))
* **ui:** show scrollbar on IRC chat channel selector ([5087644](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/5087644e41b8185af69733a34cafef7032485262))


### Features

* add live stats polling and IRC chat view ([db9e06b](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/db9e06bc0b1b80d9c21b0ca6935db611bba18442))
* **auth:** per-user streamer scoping with real sessions ([cb472b7](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/cb472b79142e8ced7629d1235738061538c8e5ae))
* **auth:** real Google OAuth + Twitch token persistence fixes ([9390b29](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/9390b29544dc7ca141360c2f219c9f5ceda4c396))
* **auth:** Twitch device-flow login + frontend connection indicator ([46cf12e](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/46cf12e26661c1096c07f772661d023385db4261))
* **chat:** filter broadcaster and known bot messages at source ([a8da994](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/a8da99462a56fc30e9eca7c34f552307167d5265))
* **dev:** mount host prisma/dev.db into the container ([9680884](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/9680884fef90bfefe121e765f81063d88da29915))
* initialize Twitch Channel Points Miner project ([c93d12b](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/c93d12b09d1ec1a0856e45e118221e27155f9626))
* **miner:** add connection tracking and monitoring ([c98b517](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/c98b517ccecd7b08e97aefc8997817680a471e8a))
* **miner:** authenticated IRC chat presence for watch-earning ([6a70b99](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/6a70b99aaeb3456c09c5429af6b8e0365ddbd57e))
* **miner:** auto-bet on prediction events via MakePrediction ([e0ecf6c](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/e0ecf6c15c5ea169d763035b6ddbec202cd7e460))
* **miner:** periodic balance re-sync every 5 min ([a633e71](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/a633e712fe7fe5a6c168968159e7fa625e15ae64))
* **miner:** persist and restore daily counters across restarts ([15a9adc](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/15a9adc168eef4d50f6ac4380a462cc028eb0a05))
* **miner:** raid following + predictions topic via PubSub ([fe4e909](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/fe4e909425b68ba07176b5727b78c57d73b49ee5))
* **miner:** real auto-claim polling + honest claim toasts ([acbccf4](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/acbccf4de5ad9953352aa783a119d619c6c8e1d0))
* **miner:** real bonus chest claiming via authenticated GQL ([344867b](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/344867b53b76cea2a3ac736448a9249d5ca6d04d))
* **miner:** real Channel Points balance sync via PubSub + TV client pairing ([7d77356](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/7d77356ef2e8be9ed58ae4af9544f48a5c2ecbb2))
* **miner:** real drop claiming via Inventory + DropsPage_ClaimDropRewards ([ccb7f87](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/ccb7f87df37d84e7ff7efb182bdc00cfe8e901b0))
* **miner:** real minute-watched heartbeats + live chest countdown ([e98cffb](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/e98cffb598a54348b9ae898104d816ed36b6c84a))
* **server:** add manual live status toggling and IRC chat support ([18db0ed](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/18db0eda8f5891b4b0efceb36824af4644ff882d))
* standardize database management scripts ([ed0f319](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/ed0f319b02ea7f92194420c18d4bfc1974bcdb53))
* **streamers:** support Twitch URLs and usernames ([883d11c](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/883d11c82c34c950d14ef56a1eff8886fe5945a5))
* **ui:** reconnect banner when Twitch token expires ([28f689c](https://github.com/niklasschaeffer/twitch-channel-miner-v3/commit/28f689cee6d8d6315fa7999eac4145fc7d8b7019))
