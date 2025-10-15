const provinces = [
  { id: 1, name: 'Province No. 1', nameNepali: 'प्रदेश नं. १' },
  { id: 2, name: 'Madhesh Pradesh', nameNepali: 'मधेश प्रदेश' },
  { id: 3, name: 'Bagmati Pradesh', nameNepali: 'बागमती प्रदेश' },
  { id: 4, name: 'Gandaki Pradesh', nameNepali: 'गण्डकी प्रदेश' },
  { id: 5, name: 'Lumbini Pradesh', nameNepali: 'लुम्बिनी प्रदेश' },
  { id: 6, name: 'Karnali Pradesh', nameNepali: 'कर्णाली प्रदेश' },
  { id: 7, name: 'Sudurpashchim Pradesh', nameNepali: 'सुदूरपश्चिम प्रदेश' }
]

const districts = [
  { provinceId: 1, name: 'Bhojpur', nameNepali: 'भोजपुर' },
  { provinceId: 1, name: 'Dhankuta', nameNepali: 'धनकुटा' },
  { provinceId: 1, name: 'Ilam', nameNepali: 'इलाम' },
  { provinceId: 1, name: 'Jhapa', nameNepali: 'झापा' },
  { provinceId: 1, name: 'Khotang', nameNepali: 'खोटाङ' },
  { provinceId: 1, name: 'Morang', nameNepali: 'मोरङ' },
  { provinceId: 1, name: 'Okhaldhunga', nameNepali: 'ओखलढुंगा' },
  { provinceId: 1, name: 'Panchthar', nameNepali: 'पाँचथर' },
  { provinceId: 1, name: 'Sankhuwasabha', nameNepali: 'सङ्खुवासभा' },
  { provinceId: 1, name: 'Solukhumbu', nameNepali: 'सोलुखुम्बु' },
  { provinceId: 1, name: 'Sunsari', nameNepali: 'सुनसरी' },
  { provinceId: 1, name: 'Taplejung', nameNepali: 'ताप्लेजुङ' },
  { provinceId: 1, name: 'Terhathum', nameNepali: 'तेह्रथुम' },
  { provinceId: 1, name: 'Udayapur', nameNepali: 'उदयपुर' },
  { provinceId: 2, name: 'Bara', nameNepali: 'बारा' },
  { provinceId: 2, name: 'Dhanusha', nameNepali: 'धनुषा' },
  { provinceId: 2, name: 'Mahottari', nameNepali: 'महोत्तरी' },
  { provinceId: 2, name: 'Parsa', nameNepali: 'पर्सा' },
  { provinceId: 2, name: 'Rautahat', nameNepali: 'रौतहट' },
  { provinceId: 2, name: 'Saptari', nameNepali: 'सप्तरी' },
  { provinceId: 2, name: 'Sarlahi', nameNepali: 'सर्लाही' },
  { provinceId: 2, name: 'Siraha', nameNepali: 'सिरहा' },
  { provinceId: 3, name: 'Bhaktapur', nameNepali: 'भक्तपुर' },
  { provinceId: 3, name: 'Chitwan', nameNepali: 'चितवन' },
  { provinceId: 3, name: 'Dhading', nameNepali: 'धादिङ' },
  { provinceId: 3, name: 'Dolakha', nameNepali: 'दोलखा' },
  { provinceId: 3, name: 'Kathmandu', nameNepali: 'काठमाडौँ' },
  { provinceId: 3, name: 'Kavrepalanchok', nameNepali: 'काभ्रेपलाञ्चोक' },
  { provinceId: 3, name: 'Lalitpur', nameNepali: 'ललितपुर' },
  { provinceId: 3, name: 'Makwanpur', nameNepali: 'मकवानपुर' },
  { provinceId: 3, name: 'Nuwakot', nameNepali: 'नुवाकोट' },
  { provinceId: 3, name: 'Ramechhap', nameNepali: 'रामेछाप' },
  { provinceId: 3, name: 'Rasuwa', nameNepali: 'रसुवा' },
  { provinceId: 3, name: 'Sindhuli', nameNepali: 'सिन्धुली' },
  { provinceId: 3, name: 'Sindhupalchok', nameNepali: 'सिन्धुपाल्चोक' },
  { provinceId: 4, name: 'Baglung', nameNepali: 'बागलुङ' },
  { provinceId: 4, name: 'Gorkha', nameNepali: 'गोरखा' },
  { provinceId: 4, name: 'Kaski', nameNepali: 'कास्की' },
  { provinceId: 4, name: 'Lamjung', nameNepali: 'लमजुङ' },
  { provinceId: 4, name: 'Manang', nameNepali: 'मनाङ' },
  { provinceId: 4, name: 'Mustang', nameNepali: 'मुस्ताङ' },
  { provinceId: 4, name: 'Myagdi', nameNepali: 'म्याग्दी' },
  { provinceId: 4, name: 'Nawalpur', nameNepali: 'नवलपुर' },
  { provinceId: 4, name: 'Parbat', nameNepali: 'पर्वत' },
  { provinceId: 4, name: 'Syangja', nameNepali: 'स्याङ्जा' },
  { provinceId: 4, name: 'Tanahun', nameNepali: 'तनहुँ' },
  { provinceId: 5, name: 'Arghakhanchi', nameNepali: 'अर्घाखाँची' },
  { provinceId: 5, name: 'Banke', nameNepali: 'बाँके' },
  { provinceId: 5, name: 'Bardiya', nameNepali: 'बर्दिया' },
  { provinceId: 5, name: 'Dang', nameNepali: 'दाङ' },
  { provinceId: 5, name: 'Gulmi', nameNepali: 'गुल्मी' },
  { provinceId: 5, name: 'Kapilvastu', nameNepali: 'कपिलवस्तु' },
  { provinceId: 5, name: 'Parasi', nameNepali: 'परासी' },
  { provinceId: 5, name: 'Palpa', nameNepali: 'पाल्पा' },
  { provinceId: 5, name: 'Pyuthan', nameNepali: 'प्यूठान' },
  { provinceId: 5, name: 'Rolpa', nameNepali: 'रोल्पा' },
  { provinceId: 5, name: 'Rukum East', nameNepali: 'रुकुम पूर्व' },
  { provinceId: 5, name: 'Rupandehi', nameNepali: 'रुपन्देही' },
  { provinceId: 6, name: 'Dailekh', nameNepali: 'दैलेख' },
  { provinceId: 6, name: 'Dolpa', nameNepali: 'डोल्पा' },
  { provinceId: 6, name: 'Humla', nameNepali: 'हुम्ला' },
  { provinceId: 6, name: 'Jajarkot', nameNepali: 'जाजरकोट' },
  { provinceId: 6, name: 'Jumla', nameNepali: 'जुम्ला' },
  { provinceId: 6, name: 'Kalikot', nameNepali: 'कालिकोट' },
  { provinceId: 6, name: 'Mugu', nameNepali: 'मुгу' },
  { provinceId: 6, name: 'Rukum West', nameNepali: 'रुकुम पश्चिम' },
  { provinceId: 6, name: 'Salyan', nameNepali: 'सल्यान' },
  { provinceId: 6, name: 'Surkhet', nameNepali: 'सुर्खेत' },
  { provinceId: 7, name: 'Achham', nameNepali: 'अछाम' },
  { provinceId: 7, name: 'Baitadi', nameNepali: 'बैतडी' },
  { provinceId: 7, name: 'Bajhang', nameNepali: 'बझाङ' },
  { provinceId: 7, name: 'Bajura', nameNepali: 'बाजुरा' },
  { provinceId: 7, name: 'Dadeldhura', nameNepali: 'डडेल्धुरा' },
  { provinceId: 7, name: 'Darchula', nameNepali: 'दार्चुला' },
  { provinceId: 7, name: 'Doti', nameNepali: 'डोटी' },
  { provinceId: 7, name: 'Kailali', nameNepali: 'कैलाली' },
  { provinceId: 7, name: 'Kanchanpur', nameNepali: 'कञ्चनपुर' }
]

export async function seedGeography(prisma) {
  // Skip if province/district tables are not present in current schema
  const provinceTable = await prisma.$queryRaw`SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Province'
  ) AS "exists"`

  const districtTable = await prisma.$queryRaw`SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'District'
  ) AS "exists"`

  const hasProvinceTable = Array.isArray(provinceTable) && provinceTable[0]?.exists
  const hasDistrictTable = Array.isArray(districtTable) && districtTable[0]?.exists

  if (!hasProvinceTable || !hasDistrictTable) {
    return { skipped: 'province/district tables unavailable' }
  }

  for (const province of provinces) {
    await prisma.province.upsert({
      where: { id: province.id },
      update: { name: province.name, nameNepali: province.nameNepali },
      create: {
        id: province.id,
        name: province.name,
        nameNepali: province.nameNepali
      }
    })
  }

  for (const district of districts) {
    await prisma.district.upsert({
      where: {
        provinceId_name: {
          provinceId: district.provinceId,
          name: district.name
        }
      },
      update: { nameNepali: district.nameNepali },
      create: district
    })
  }

  return { upsertedProvinces: provinces.length, upsertedDistricts: districts.length }
}
