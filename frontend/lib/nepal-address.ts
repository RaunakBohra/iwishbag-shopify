export interface DistrictOption {
  code: string
  name: string
}

export interface ProvinceOption {
  code: string
  name: string
  districts: DistrictOption[]
}

export const PROVINCES: ProvinceOption[] = [
  {
    code: 'koshi',
    name: 'Koshi Province',
    districts: [
      { code: 'bhojpur', name: 'Bhojpur' },
      { code: 'dhankuta', name: 'Dhankuta' },
      { code: 'ilam', name: 'Ilam' },
      { code: 'jhapa', name: 'Jhapa' },
      { code: 'khotang', name: 'Khotang' },
      { code: 'morang', name: 'Morang' },
      { code: 'okhaldhunga', name: 'Okhaldhunga' },
      { code: 'panchthar', name: 'Panchthar' },
      { code: 'sankhuwasabha', name: 'Sankhuwasabha' },
      { code: 'solukhumbu', name: 'Solukhumbu' },
      { code: 'sunsari', name: 'Sunsari' },
      { code: 'taplejung', name: 'Taplejung' },
      { code: 'terhathum', name: 'Terhathum' },
      { code: 'udayapur', name: 'Udayapur' }
    ]
  },
  {
    code: 'madhesh',
    name: 'Madhesh Province',
    districts: [
      { code: 'bara', name: 'Bara' },
      { code: 'dhanusha', name: 'Dhanusha' },
      { code: 'mahottari', name: 'Mahottari' },
      { code: 'parsa', name: 'Parsa' },
      { code: 'rautahat', name: 'Rautahat' },
      { code: 'saptari', name: 'Saptari' },
      { code: 'sarlahi', name: 'Sarlahi' },
      { code: 'siraha', name: 'Siraha' }
    ]
  },
  {
    code: 'bagmati',
    name: 'Bagmati Province',
    districts: [
      { code: 'bhaktapur', name: 'Bhaktapur' },
      { code: 'chitwan', name: 'Chitwan' },
      { code: 'dhading', name: 'Dhading' },
      { code: 'dolakha', name: 'Dolakha' },
      { code: 'kathmandu', name: 'Kathmandu' },
      { code: 'kavrepalanchok', name: 'Kavrepalanchok' },
      { code: 'lalitpur', name: 'Lalitpur' },
      { code: 'makawanpur', name: 'Makawanpur' },
      { code: 'nuwakot', name: 'Nuwakot' },
      { code: 'ramechhap', name: 'Ramechhap' },
      { code: 'rasuwa', name: 'Rasuwa' },
      { code: 'sindhuli', name: 'Sindhuli' },
      { code: 'sindhupalchok', name: 'Sindhupalchok' }
    ]
  },
  {
    code: 'gandaki',
    name: 'Gandaki Province',
    districts: [
      { code: 'baglung', name: 'Baglung' },
      { code: 'gorkha', name: 'Gorkha' },
      { code: 'kaski', name: 'Kaski' },
      { code: 'lamjung', name: 'Lamjung' },
      { code: 'manang', name: 'Manang' },
      { code: 'mustang', name: 'Mustang' },
      { code: 'myagdi', name: 'Myagdi' },
      { code: 'nawalpur', name: 'Nawalpur' },
      { code: 'parbat', name: 'Parbat' },
      { code: 'syangja', name: 'Syangja' },
      { code: 'tanahun', name: 'Tanahun' }
    ]
  },
  {
    code: 'lumbini',
    name: 'Lumbini Province',
    districts: [
      { code: 'arghakhanchi', name: 'Arghakhanchi' },
      { code: 'banke', name: 'Banke' },
      { code: 'bardiya', name: 'Bardiya' },
      { code: 'dang', name: 'Dang' },
      { code: 'gulmi', name: 'Gulmi' },
      { code: 'kapilvastu', name: 'Kapilvastu' },
      { code: 'nawalparasi', name: 'Parasi (Nawalparasi West)' },
      { code: 'palpa', name: 'Palpa' },
      { code: 'pyuthan', name: 'Pyuthan' },
      { code: 'rolpa', name: 'Rolpa' },
      { code: 'rukum-east', name: 'Rukum (East)' },
      { code: 'rupandehi', name: 'Rupandehi' }
    ]
  },
  {
    code: 'karnali',
    name: 'Karnali Province',
    districts: [
      { code: 'dailekh', name: 'Dailekh' },
      { code: 'dolpa', name: 'Dolpa' },
      { code: 'humla', name: 'Humla' },
      { code: 'jajarkot', name: 'Jajarkot' },
      { code: 'jumla', name: 'Jumla' },
      { code: 'kalikot', name: 'Kalikot' },
      { code: 'mugu', name: 'Mugu' },
      { code: 'rukum-west', name: 'Rukum (West)' },
      { code: 'salyan', name: 'Salyan' },
      { code: 'surkhet', name: 'Surkhet' }
    ]
  },
  {
    code: 'sudurpaschim',
    name: 'Sudurpashchim Province',
    districts: [
      { code: 'achham', name: 'Achham' },
      { code: 'baitadi', name: 'Baitadi' },
      { code: 'bajhang', name: 'Bajhang' },
      { code: 'bajura', name: 'Bajura' },
      { code: 'dadeldhura', name: 'Dadeldhura' },
      { code: 'darchula', name: 'Darchula' },
      { code: 'doti', name: 'Doti' },
      { code: 'kailali', name: 'Kailali' },
      { code: 'kanchanpur', name: 'Kanchanpur' }
    ]
  }
]

export function findProvince(code: string): ProvinceOption | undefined {
  return PROVINCES.find((province) => province.code === code)
}
