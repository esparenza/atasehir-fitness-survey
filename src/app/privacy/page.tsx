export const metadata = {
  title: "Gizlilik Politikası | Ataşehir Fitness",
  description: "Ataşehir Fitness üye memnuniyet sistemi gizlilik politikası.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-zinc-300">
      <h1 className="font-display text-3xl font-bold text-white mb-6">Gizlilik Politikası</h1>
      <p className="text-sm text-zinc-400 mb-8">Son güncelleme: 16 Ekim 2026</p>

      <section className="space-y-6 text-sm leading-relaxed">
        <p>
          Ataşehir Fitness (&quot;biz&quot;, &quot;kulübümüz&quot;), üyelerimizin gizliliğine ve kişisel verilerinin korunmasına büyük önem vermektedir. Bu Gizlilik Politikası, WhatsApp üzerinden yürüttüğümüz üye memnuniyet ve geri bildirim sistemi kapsamında toplanan bilgilerin nasıl işlendiğini açıklamaktadır.
        </p>

        <h2 className="text-lg font-semibold text-white mt-6">1. Toplanan Veriler</h2>
        <p>
          Anket sürecinde yalnızca üyelerimizin adı, telefon numarası ve anket kapsamında gönüllü olarak paylaştıkları salon ekipmanları, temizlik ve eğitmen hizmetlerine ilişkin görüş ve değerlendirmeleri işlenir.
        </p>

        <h2 className="text-lg font-semibold text-white mt-6">2. Verilerin Kullanım Amacı</h2>
        <p>
          Toplanan geri bildirimler, yalnızca salon hizmet kalitesini artırmak, üye memnuniyetini ölçmek ve varsa şikayetleri çözüme kavuşturmak amacıyla kullanılır. Kişisel veriler üçüncü taraflarla reklam veya pazarlama amacıyla paylaşılmaz.
        </p>

        <h2 className="text-lg font-semibold text-white mt-6">3. İletişim ve Veri Silme</h2>
        <p>
          Üyelerimiz istedikleri zaman anketi sonlandırabilir veya verilerinin silinmesini talep edebilir. Talepleriniz için kulüp resepsiyonumuz veya doğrudan iletişim kanallarımız üzerinden bize ulaşabilirsiniz.
        </p>
      </section>
    </main>
  );
}
