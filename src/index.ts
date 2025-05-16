import App from '@/App';
import config from '@/config';

const container = document.body;
const app = new App(container, config);
app.init();
app.start();
