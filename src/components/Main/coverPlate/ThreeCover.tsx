import { useTranslation } from 'react-i18next';
export default function ThreeCover({
  config,
  onNext
}: any) {
  const {
    t
  } = useTranslation();
  return <div className="w-full h-full bg-[#545454] absolute left-0 top-0 z-50">
      <div className="w-full mt-24 flex justify-center">
        <button className="bg-og w-4/5 p-3 text-white" onClick={() => {
        sessionStorage.setItem('state', JSON.stringify(true));
        onNext();
      }}>{t('modal.age_confirmation')}</button>
      </div>
      <div className="fixed bottom-2 left-0 right-0 flex justify-between px-6 py-1 text-white">
        <span>© 2008-2025 禁漫天堂</span><span>JM v{config.version}</span>
      </div>
    </div>;
}
