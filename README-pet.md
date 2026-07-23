# 🧡 Mango — 2D Pet Simulator for any website

A tiny, dependency-free virtual pet that lives on your web page. It walks, hops,
jumps, flies around the whole screen, dances, eats, and naps on its own — and
reacts when you tap it. Works on desktop and mobile.

## Files

| File | What it is |
|------|------------|
| `pet-widget.js` | **The pet, as one standalone script.** Drop it into any website. |
| `index.html` | Demo / landing page showing the pet live, with install instructions. |

## Quick start (any website, incl. WordPress)

Upload `pet-widget.js` somewhere on your site, then paste this right before
`</body>`:

```html
<script>
  window.PetConfig = { name: "Mango", size: 110, controls: true };
</script>
<script src="pet-widget.js"></script>
```

On WordPress: use a *Custom HTML* block, your theme's `footer.php`, or any
"insert headers & footers" plugin.

## Config (all optional)

```js
window.PetConfig = {
  name:       "Mango",      // pet's name
  size:       110,          // pet size in px
  controls:   true,         // show the 🐾 control panel (feed/jump/fly/dance/sleep + command box)
  bottom:     0,            // px above the bottom of the screen where the pet walks
  zIndex:     999999,       // stacking order of the overlay
  storageKey: "pet-widget", // localStorage key (stats + name persist between visits)
};
```

## JavaScript API

```js
Pet.feed();  Pet.jump();  Pet.fly();  Pet.dance();  Pet.sleep();  Pet.pet();  Pet.wake();
Pet.say("Welcome to my site!");
Pet.setName("Pip");
Pet.command("dance");   // same commands as the panel's text box
Pet.stats();            // → { food, fun, energy, name }
```

Text commands understood by `Pet.command()` and the 🐾 panel input:
`feed`, `jump`, `hop`, `fly`, `dance`, `sleep`, `wake`, `pet`, `come`, `hi`,
`name <newname>`, and a few fun aliases.

## Notes

- The overlay never blocks your page — only the pet and the 🐾 panel are clickable.
- Stats (🍎 food, 💖 fun, ⚡ energy) drift over time; the pet naps when exhausted
  and asks for food when hungry.
- No build step, no dependencies. One font is loaded from Google Fonts (falls
  back gracefully if offline).
