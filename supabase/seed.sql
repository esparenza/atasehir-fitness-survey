-- Opsiyonel örnek veri (gerçek Supabase'e yüklemek isterseniz)
with m as (
  insert into public.members (full_name, phone_number, survey_status) values
    ('Ahmet Yılmaz','905551110001','tamamlandi'),
    ('Elif Demir','905551110002','tamamlandi'),
    ('Burak Kaya','905551110003','tamamlandi'),
    ('Zeynep Arslan','905551110004','devam_ediyor'),
    ('Mehmet Çelik','905551110005','bekliyor')
  on conflict (phone_number) do nothing
  returning id, phone_number
)
insert into public.survey_analyses
  (member_id, overall_score, equipment_score, hygiene_score, staff_score, sentiment, summary, critical_alert)
select id,
  case phone_number when '905551110001' then 9 when '905551110002' then 6 else 2 end,
  case phone_number when '905551110001' then 9 when '905551110002' then 5 else 4 end,
  case phone_number when '905551110001' then 9 when '905551110002' then 6 else 1 end,
  case phone_number when '905551110001' then 10 when '905551110002' then 7 else 2 end,
  case phone_number when '905551110001' then 'pozitif' when '905551110002' then 'notr' else 'negatif' end,
  case phone_number
    when '905551110001' then 'Üye salondan çok memnun, eğitmenleri özellikle övüyor.'
    when '905551110002' then 'Ekipman yoğun saatlerde yetersiz kalıyor, diğer konularda sorun yok.'
    else 'Duşlar ve soyunma odası temizliğinden çok şikayetçi, üyeliğini bırakmayı düşünüyor.' end,
  phone_number = '905551110003'
from m
where phone_number in ('905551110001','905551110002','905551110003');
