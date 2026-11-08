import { useEffect } from 'preact/hooks';
import { DialogHost, ToastHost } from './components/toast';
import { TabBar } from './components/chrome';
import { db } from './lib/store';
import { go, route } from './lib/router';
import { RentScreen } from './screens/rent/RentScreen';
import { RentSettings } from './screens/rent/RentSettings';
import { ProjectsScreen } from './screens/Projects';
import { NewProject } from './screens/NewProject';
import { ProjectScreen } from './screens/project/ProjectScreen';
import { ExpenseForm } from './screens/project/ExpenseForm';
import { ProjectSettings } from './screens/project/ProjectSettings';
import { JoinScreen } from './screens/Join';
import { SettingsScreen } from './screens/Settings';

function useTheme() {
  const theme = db.value.prefs.theme;
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);
}

export function App() {
  useTheme();
  const r = route.value;
  const [a, b, c, d] = r;

  useEffect(() => {
    if (!a) go(db.value.prefs.tab === 'projects' ? 'projects' : 'rent', true);
  }, [a]);

  let screen = null;
  let tabs = true;
  switch (a) {
    case 'rent':
      if (b === 'settings') {
        screen = <RentSettings />;
        tabs = false;
      } else if (b === 'new') screen = <RentScreen view="setup" />;
      else if (b === 'history') screen = <RentScreen view="history" />;
      else screen = <RentScreen view="month" month={b === 'm' ? c : undefined} />;
      break;
    case 'projects':
      screen = <ProjectsScreen />;
      break;
    case 'new':
      screen = <NewProject />;
      tabs = false;
      break;
    case 'p':
      if (c === 'e') {
        screen = <ExpenseForm projectId={b} expenseId={d} />;
        tabs = false;
      } else if (c === 'settings') {
        screen = <ProjectSettings projectId={b} />;
        tabs = false;
      } else screen = <ProjectScreen projectId={b} tab={c} extra={d} />;
      break;
    case 'join':
      screen = <JoinScreen token={b} />;
      tabs = false;
      break;
    case 'k':
      screen = <SettingsScreen importKey={b} />;
      break;
    case 'settings':
      screen = <SettingsScreen />;
      break;
    default:
      screen = null;
  }

  return (
    <div class={'app' + (tabs ? ' with-tabs' : '')}>
      <main class="screen">{screen}</main>
      {tabs && <TabBar />}
      <ToastHost />
      <DialogHost />
    </div>
  );
}
