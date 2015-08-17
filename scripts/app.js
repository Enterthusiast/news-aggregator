/**
 *
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
APP.Main = (function() {

  var LAZY_LOAD_THRESHOLD = 300;
  var $ = document.querySelector.bind(document);

  var stories = null;
  var storyStart = 0;
  var count = 15;
  var main = $('main');
  var inDetails = false;
  var storyLoadCount = 0;
  var localeData = {
    data: {
      intl: {
        locales: 'en-US'
      }
    }
  };

  var tmplStory = $('#tmpl-story').textContent;
  var tmplStoryDetails = $('#tmpl-story-details').textContent;
  var tmplStoryDetailsComment = $('#tmpl-story-details-comment').textContent;

  if (typeof HandlebarsIntl !== 'undefined') {
    HandlebarsIntl.registerWith(Handlebars);
  } else {

    // Remove references to formatRelative, because Intl isn't supported.
    var intlRelative = /, {{ formatRelative time }}/;
    tmplStory = tmplStory.replace(intlRelative, '');
    tmplStoryDetails = tmplStoryDetails.replace(intlRelative, '');
    tmplStoryDetailsComment = tmplStoryDetailsComment.replace(intlRelative, '');
  }

  var storyTemplate =
      Handlebars.compile(tmplStory);
  var storyDetailsTemplate =
      Handlebars.compile(tmplStoryDetails);
  var storyDetailsCommentTemplate =
      Handlebars.compile(tmplStoryDetailsComment);

  /**
   * As every single story arrives in shove its
   * content in at that exact moment. Feels like something
   * that should really be handled more delicately, and
   * probably in a requestAnimationFrame callback.
   */
  function onStoryData (key, details) {

    // This seems odd. Surely we could just select the story
    // directly rather than looping through all of them.
    var storyElements = document.querySelector('#s-' + key);
    details.time *= 1000;
    var story = storyElements;
    var html = storyTemplate(details);
    story.innerHTML = html;
    story.addEventListener('click', onStoryClick.bind(this, details));
    story.classList.add('clickable');

    colorizeAndScaleStories(story);

    // Tick down. When zero we can batch in the next load.
    storyLoadCount--;
  }

  function onStoryClick(details) {

    var storyDetails = $('sd-' + details.id);

    // Wait a little time then show the story details.
    requestAnimationFrame(showStory.bind(this, details.id));

    // Create and append the story. A visual change...
    // perhaps that should be in a requestAnimationFrame?
    // And maybe, since they're all the same, I don't
    // need to make a new element every single time? I mean,
    // it inflates the DOM and I can only see one at once.
    if (!storyDetails) {

      if (details.url)
        details.urlobj = new URL(details.url);

      var comment;
      var commentsElement;
      var storyHeader;
      var storyContent;

      var storyDetailsHtml = storyDetailsTemplate(details);
      var kids = details.kids;
      var commentHtml = storyDetailsCommentTemplate({
        by: '', text: 'Loading comment...'
      });

      storyDetails = document.createElement('section');
      storyDetails.setAttribute('id', 'sd-' + details.id);
      storyDetails.classList.add('story-details');
      storyDetails.innerHTML = storyDetailsHtml;

      document.body.appendChild(storyDetails);

      commentsElement = storyDetails.querySelector('.js-comments');
      storyHeader = storyDetails.querySelector('.js-header');
      storyContent = storyDetails.querySelector('.js-content');

      var closeButton = storyDetails.querySelector('.js-close');
      closeButton.addEventListener('click', hideStory.bind(this, details.id));

      var headerHeight = storyHeader.getBoundingClientRect().height;
      storyContent.style.paddingTop = headerHeight + 'px';

      if (typeof kids === 'undefined')
        return;

      for (var k = 0; k < kids.length; k++) {

        comment = document.createElement('aside');
        comment.setAttribute('id', 'sdc-' + kids[k]);
        comment.classList.add('story-details__comment');
        comment.innerHTML = commentHtml;
        commentsElement.appendChild(comment);

        // Update the comment with the live data.
        APP.Data.getStoryComment(kids[k], function(commentDetails) {

          commentDetails.time *= 1000;

          var comment = commentsElement.querySelector(
              '#sdc-' + commentDetails.id);
          comment.innerHTML = storyDetailsCommentTemplate(
              commentDetails,
              localeData);
        });
      }
    }

  }

  function showStory(id) {

    if (inDetails)
      return;

    inDetails = true;

    var storyDetails = $('#sd-' + id);
    var left = null;

    if (!storyDetails)
      return;

    //document.body.classList.add('details-active');
    storyDetails.style.opacity = 1;

    function animate () {

      // Find out where it currently is.
      var storyDetailsPosition = storyDetails.getBoundingClientRect();
      var storyDetailsPositionLeft = storyDetailsPosition.left;

      // Set the left value if we don't have one already.
      if (left === null)
        left = storyDetailsPositionLeft;

      // Now figure out where it needs to go.
      left += (0 - storyDetailsPositionLeft) * 0.2;

      // Set up the next bit of the animation if there is more to do.
      if (Math.abs(left) > 0.5)
        requestAnimationFrame(animate);
      else
        left = 0;

      // And update the styles. Wait, is this a read-write cycle?
      // I hope I don't trigger a forced synchronous layout!
      storyDetails.style.left = left + 'px';
    }

    // We want slick, right, so let's do a setTimeout
    // every few milliseconds. That's going to keep
    // it all tight. Or maybe we're doing visual changes
    // and they should be in a requestAnimationFrame
    requestAnimationFrame(animate);
  }

  function hideStory(id) {

    if (!inDetails)
      return;

    var storyDetails = $('#sd-' + id);
    var left = 0;
    var mainPosition = main.getBoundingClientRect();
    var target = mainPosition.width + 100;

    // //document.body.classList.remove('details-active');
    // //storyDetails.style.opacity = 0;

    // /* FLIP TEST */
    // // Get the first position.
    // var first = storyDetails.getBoundingClientRect();

    // // Now set the element to the last position.
    // //el.classList.add('totes-at-the-end');
    // storyDetails.style.transform = 'translateX(' + target + 'px)';

    // // Read again. This forces a sync layout, so be careful.
    // var last = storyDetails.getBoundingClientRect();

    // // You can do this for other computed styles as well, if needed.
    // // Just be sure to stick to compositor-only props like transform
    // // and opacity where possible.
    // var invert =  first.left - last.left;

    // // Invert.
    // storyDetails.style.transform = '';

    // // Wait for the next frame so we know all the style changes have taken hold.
    // requestAnimationFrame(function() {

    //   // Switch on animations.
    //   //el.classList.add('animate-on-transforms');
    //   storyDetails.style.transition = '2s';
    //   //storyDetails.style.transform = 'translateX(' + target + 'px)';

    //   // GO GO GOOOOOO!
    //   storyDetails.style.transform = 'translateX(' + target + 'px)';
    // });

    // // Capture the end with transitionend
    // //storyDetails.addEventListener('transitionend', tidyUpAnimations);
    // /* FLIP END */


    function animate () {

      // Find out where it currently is.
      var storyDetailsPosition = storyDetails.getBoundingClientRect();
      var storyDetailsPositionLeft = storyDetailsPosition.left;

      // Now figure out where it needs to go.
      left += (target - storyDetailsPositionLeft) * 0.2;

      // Set up the next bit of the animation if there is more to do.
      if (Math.abs(left - target) > 0.5 && storyDetailsPositionLeft > -10000) {
        requestAnimationFrame(animate);
      } else {
        left = target;
        inDetails = false;

        // Find what shoudl be removed
        var storiesToRemove = document.body.getElementsByClassName('story-details');
        // Store how many element are return for the stories to remove query
        toRemoveLength = storiesToRemove.length;
        for (var i = 0; i < toRemoveLength; i+=1) {
          // Remove the first element returned by the query as much time as there was an element
          document.body.removeChild(storiesToRemove[0]);
        }
      }

      // And update the styles. Wait, is this a read-write cycle?
      // I hope I don't trigger a forced synchronous layout!
      storyDetails.style.left = left + 'px';
    }

    // We want slick, right, so let's do a setTimeout
    // every few milliseconds. That's going to keep
    // it all tight. Or maybe we're doing visual changes
    // and they should be in a requestAnimationFrame
    requestAnimationFrame(animate);
  }

  /**
   * Does this really add anything? Can we do this kind
   * of work in a cheaper way?
   */
  // Their was cheaper way I only change the color of article that were visible
  // but it gaves no useful information to the reader, was even misleading
  // Now brighter and bigger means more popular
  // we will modify this function to be called only when new articles arrive
  function colorizeAndScaleStories(element) {
    var story = element;
    var ScaleFactor = 0.003;
    var SaturationValueBuffer = 50;
    var score = story.querySelector('.story__score');
    var scoreValue = score.innerHTML;
    var blobSize = 40;

    // Now bigger means more popular
    var scale = Math.min(1, 0.5 + (ScaleFactor * scoreValue));
    // Now saturation is only related to the score
    var saturation = (scoreValue - SaturationValueBuffer);
    //Apply style
    var newBlobSize = scale * blobSize;
    score.style.width = (newBlobSize) + 'px';
    score.style.height = (newBlobSize) + 'px';
    score.style.lineHeight = (newBlobSize) + 'px';
    score.style.margin = ((40 - (newBlobSize)) / 2) + 'px';
    //score.style.transform = 'scale(' + scale + ',' + scale + ')';
    score.style.backgroundColor = 'hsl(42, ' + saturation + '%, 50%)';

    return story;
  }

  // main.addEventListener('touchstart', function(evt) {

  //   // I just wanted to test what happens if touchstart
  //   // gets canceled. Hope it doesn't block scrolling on mobiles...
  //   if (Math.random() > 0.97) {
  //     evt.preventDefault();
  //   }

  // });

  main.addEventListener('scroll', function() {

    // Add a shadow, change font-size and height to the header.
    var raisedValue = document.body.classList.contains('raised');
    if (main.scrollTop > 70 && raisedValue === false) {
      document.body.classList.add('raised');
    } else if (main.scrollTop < 70 && raisedValue === true){
      document.body.classList.remove('raised');
    }

    // Check if we need to load the next batch of stories.
    var loadThreshold = (main.scrollHeight - main.offsetHeight -
        LAZY_LOAD_THRESHOLD);
    if (main.scrollTop > loadThreshold)
      loadStoryBatch();
  });

  function loadStoryBatch() {
    var storiesArray = [];

    if (storyLoadCount > 0)
      return;

    storyLoadCount = count;

    var end = storyStart + count;
    for (var i = storyStart; i < end; i++) {

      if (i >= stories.length)
        return;

      var key = String(stories[i]);
      var story = document.createElement('div');
      story.setAttribute('id', 's-' + key);
      story.classList.add('story');
      story.innerHTML = storyTemplate({
        title: '...',
        score: '-',
        by: '...',
        time: 0
      });

      //Make it Clickable & colorize/scale
      APP.Data.getStoryById(stories[i], onStoryData.bind(this, key));

      storiesArray.push(story);
    }

    storiesArray.forEach(function(story){
      // Then add to the page
      main.appendChild(story);
    });

    storyStart += count;

  }

  // Bootstrap in the stories.
  APP.Data.getTopStories(function(data) {
    stories = data;
    loadStoryBatch();
    main.classList.remove('loading');
  });

})();
