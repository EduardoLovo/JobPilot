<template>
  <header class="topbar">
    <strong>JobPilot</strong>
  </header>
  <main>
    <RouterView />
  </main>
</template>

<style>
body {
  margin: 0;
  font-family: system-ui, sans-serif;
  color: #1f2328;
  background: #f6f8fa;
}

.topbar {
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #d0d7de;
}

main {
  padding: 24px;
}
</style>
