The walking, jogging and jumping animations are derived from subject 02, trials 01, 03 and 04, of the [CMU Graphics Lab Motion Capture Database](https://mocap.cs.cmu.edu/subjects/02/). The database was created with funding from NSF EIA-0196217.

The [CMU terms](https://mocap.cs.cmu.edu/) allow inclusion in products. The [FAQ](https://mocap.cs.cmu.edu/faqs.php) permits copying, modification and redistribution. This project packages retargeted, in-place excerpts.

To regenerate `locomotion.json`, download `02.asf`, `02_01.amc`, `02_03.amc` and `02_04.amc` into one directory inside the development container and run `node scripts/bake-motion.mjs /path/to/captures` from `/ttfarm`.
