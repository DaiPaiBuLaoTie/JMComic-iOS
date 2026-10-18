import './platform/bootstrap';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import 'react-lazy-load-image-component/src/effects/blur.css';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/virtual';
import './platform/ios.css';
import './i18n';
import App from './App';
import { GlobalConfigProvider } from './GlobalContext';
import store from './store';

const element = document.getElementById('root');
if (!element) throw new Error('Application root is missing');
createRoot(element).render(<BrowserRouter><Provider store={store}><GlobalConfigProvider><App /></GlobalConfigProvider></Provider></BrowserRouter>);
