import './styles.css'
import { logo, trellis } from './ui/icons'
import { hasFields } from './state'
import { mountOverview } from './overview'
import { mountOnboarding } from './onboarding'

type Route = 'overview' | 'onboarding'

const app = document.querySelector<HTMLDivElement>('#app')!

const today = new Date()
const locStr = today.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

let route: Route = hasFields() ? 'overview' : 'onboarding'

function shell(): HTMLElement {
  app.innerHTML = `
    <header class="bar">
      ${trellis}
      ${logo}
      <div class="wm">Dolden<small>Blick</small></div>
      <div class="seg">
        <button data-r="overview" class="${route === 'overview' ? 'act' : ''}">Übersicht</button>
        <button data-r="onboarding" class="${route === 'onboarding' ? 'act' : ''}">Felder</button>
      </div>
      <div class="spacer"></div>
      <div class="loc">${locStr} · Au i. d. Hallertau</div>
      <div class="avatar">FH</div>
    </header>
    <main class="view" id="view"></main>
    <footer class="foot">
      <b>DoldenBlick</b> — lauffähiger Prototyp · Datenquellen: Open-Meteo, DWD (Bright Sky),
      LfL Bayern, Copernicus/Sentinel, Bayerische Vermessungsverwaltung · Kartenbasis OpenFreeMap/OpenMapTiles
    </footer>`
  app.querySelectorAll<HTMLButtonElement>('.seg button').forEach((b) =>
    b.addEventListener('click', () => navigate(b.dataset.r as Route)),
  )
  return app.querySelector<HTMLElement>('#view')!
}

function navigate(r: Route) {
  route = r
  render()
}

function render() {
  const view = shell()
  if (route === 'overview') {
    if (!hasFields()) {
      // Ohne Felder direkt ins Onboarding leiten.
      route = 'onboarding'
      mountOnboarding(shell(), () => navigate('overview'))
      return
    }
    mountOverview(view)
  } else {
    mountOnboarding(view, () => navigate('overview'))
  }
}

render()
