# TODO

- Add Google Analytics event tracking for each bento box interaction
- Add open graph image
- Add Favicon
- Update the social icons to better SVGs
- Collect assets for each carousel
- Write short bio
- Add content to pets box
- Add content to peterandconsuelo box


# IDEAS AND CONSIDERATIONS

- Loading throbber to preload images/fonts
- Add a setting so that the box carousel is cover or contain. The default should be cover. 
- Add a Spokenote box
- Add a guitar building box with a carousel
- Add an electronics box that features the Sparrow Sleeps kiosk, guitar pedal, etc.


# DONE

- Add carousels to select boxes
- Make the background gray, not off white
- Add a lightmode / darkmode toggle button in the main About Me box. It should default to the OS preference.
- Make the position and scale of the carousel slide smoothly transition from the bento box to the full screen experience. This should have a 1.5s transition. 
- Make the boxes with carousels transition their slides at different times (only one transitions at a time.) They shouldn't transition in order so it feels more random. Slow down the slide length so transitions don't happen as frequently.
- Add robots.txt and block TODO.md
- Add a copyright footer
- When the carousels are transitioning between box and fullscreen, also fade the overlay behind them at the same time. 
- Add floating next / preview arrow buttons to the full screen carousel experience
- Add link to peterandconsuelo.com in the Family box
- Add Open Graph and Twitter Card meta tags
- Add Google Analytics
- Animate the boxes in using CSS sibling-index()
- Make the carousel transition to/from fullscreen feel like a single image is transitioning to fullscreen and back, not that there are two images. To do this, make the box version of the image hidden while the copy that transitions to fullscreen is the visible representation of that image. You should still see the subtle outline of the "empty" box while the carousel slide is transitioning.
- Add [hendogisforever.net](https://thehendogisforever.net/) box with a #28448e background and white text
- Add an [iconshavefeelingstoo.com](https://iconshavefeelingstoo.com/) box with a white background and black text.
- Lazy load the images
- For the 5 boxes with external text links, make sure they all have the same utm parameter that peterandconsuelo.com have. Then add an SVG arrow pointing right to the right of the text. On hover, give a subtle ~5px slide to the right for that arrow. 
- The fullscreen background overlay should respect the dark/light mode setting. The text and close button will need to adjust to this background color setting as well.
- Use the same CSS styling for slide border radius from the peterandconsuelo repo (no border radius when the image touches the viewport sides)
- Update the README to include more context about the site
- Select and include custom web fonts