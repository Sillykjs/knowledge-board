<template>
  <div id="app">
    <NoteWall />
  </div>
</template>

<script>
import NoteWall from './components/NoteWall.vue';

export default {
  name: 'App',
  components: {
    NoteWall
  }
};
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  overflow: hidden;
}

#app {
  width: 100vw;
  height: 100vh;
}
</style>
