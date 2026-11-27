import { TemplateCategory } from '../../domain/categories/category-template';
import { ColorKey } from '../../shared/ui/colors/color-palette';
import { IconName } from '../../shared/ui/icons/icon-glyphs';
import { CategoryKind } from '../categories/category.models';

interface TypedTemplateCategory extends TemplateCategory {
  readonly icon: IconName;
  readonly color: ColorKey;
  readonly children: readonly { readonly name: string; readonly icon: IconName }[];
}

/** Suggested categories of a new space (spec Anexo A), with their icons and colors. */
export const CATEGORY_TEMPLATE: Readonly<Record<CategoryKind, readonly TypedTemplateCategory[]>> = {
  expense: [
    {
      name: 'Hogar',
      icon: 'home',
      color: 'orange',
      children: [
        { name: 'Arriendo o hipoteca', icon: 'key' },
        { name: 'Servicios públicos', icon: 'bolt' },
        { name: 'Internet y telefonía', icon: 'wifi' },
        { name: 'Mantenimiento', icon: 'handyman' },
        { name: 'Aseo', icon: 'cleaning_services' },
      ],
    },
    {
      name: 'Mercado',
      icon: 'shopping_cart',
      color: 'green',
      children: [
        { name: 'Supermercado', icon: 'local_grocery_store' },
        { name: 'Plaza', icon: 'grocery' },
        { name: 'Tienda', icon: 'store' },
      ],
    },
    {
      name: 'Transporte',
      icon: 'directions_car',
      color: 'blue',
      children: [
        { name: 'Combustible', icon: 'local_gas_station' },
        { name: 'Transporte público', icon: 'directions_bus' },
        { name: 'Mantenimiento del vehículo', icon: 'car_repair' },
        { name: 'Parqueadero', icon: 'local_parking' },
        { name: 'Peajes', icon: 'toll' },
      ],
    },
    {
      name: 'Salud',
      icon: 'medical_services',
      color: 'red',
      children: [
        { name: 'Medicamentos', icon: 'medication' },
        { name: 'Consultas', icon: 'stethoscope' },
        { name: 'Seguros de salud', icon: 'health_and_safety' },
      ],
    },
    {
      name: 'Educación',
      icon: 'school',
      color: 'indigo',
      children: [
        { name: 'Colegio', icon: 'school' },
        { name: 'Útiles', icon: 'backpack' },
        { name: 'Cursos', icon: 'cast_for_education' },
      ],
    },
    {
      name: 'Ocio',
      icon: 'celebration',
      color: 'purple',
      children: [
        { name: 'Salidas', icon: 'nightlife' },
        { name: 'Viajes', icon: 'flight' },
        { name: 'Juegos', icon: 'sports_esports' },
      ],
    },
    {
      name: 'Restaurantes y domicilios',
      icon: 'restaurant',
      color: 'orange-dark',
      children: [
        { name: 'Restaurantes', icon: 'restaurant_menu' },
        { name: 'Domicilios', icon: 'delivery_dining' },
        { name: 'Antojos', icon: 'icecream' },
      ],
    },
    {
      name: 'Compras',
      icon: 'shopping_bag',
      color: 'pink',
      children: [
        { name: 'Ropa', icon: 'checkroom' },
        { name: 'Tecnología', icon: 'devices' },
        { name: 'Hogar', icon: 'chair' },
      ],
    },
    {
      name: 'Suscripciones',
      icon: 'subscriptions',
      color: 'violet',
      children: [
        { name: 'Streaming', icon: 'live_tv' },
        { name: 'Software', icon: 'computer' },
        { name: 'Otras', icon: 'autorenew' },
      ],
    },
    {
      name: 'Mascotas',
      icon: 'pets',
      color: 'brown-light',
      children: [
        { name: 'Comida', icon: 'pet_supplies' },
        { name: 'Veterinario', icon: 'local_hospital' },
      ],
    },
    { name: 'Regalos', icon: 'card_giftcard', color: 'pink', children: [] },
    {
      name: 'Financieros',
      icon: 'account_balance',
      color: 'gray-deep',
      children: [
        { name: 'Intereses', icon: 'percent' },
        { name: 'Cuota de manejo', icon: 'credit_card' },
        { name: 'Seguros', icon: 'shield' },
        { name: 'Comisiones', icon: 'receipt_long' },
      ],
    },
    { name: 'Otros', icon: 'more_horiz', color: 'gray', children: [] },
  ],
  income: [
    { name: 'Salario', icon: 'work', color: 'green-deep', children: [] },
    { name: 'Trabajo independiente', icon: 'business_center', color: 'teal', children: [] },
    { name: 'Intereses', icon: 'savings', color: 'cyan', children: [] },
    { name: 'Otros', icon: 'paid', color: 'lime', children: [] },
  ],
};

/** Tags the wizard suggests while they do not exist yet (spec Anexo A). */
export const SUGGESTED_TAGS: readonly {
  readonly name: string;
  readonly color: ColorKey;
  readonly description: string;
}[] = [
  {
    name: 'Fijos',
    color: 'indigo',
    description: 'Lo que pagas cada mes, como el arriendo o el internet.',
  },
];
