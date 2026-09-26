<?php

declare(strict_types=1);

namespace App\Modules\Catalogue\Resources;

use App\Models\Party;
use App\Models\PartyAddress;
use App\Models\PartyContact;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Party */
final class PartyResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->uuid,
            'uuid' => $this->uuid,
            'numeric_id' => $this->id,
            'party_id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'legal_name' => $this->legal_name,
            'is_supplier' => $this->is_supplier,
            'is_customer' => $this->is_customer,
            'is_dealer' => $this->is_dealer,
            'is_agent' => $this->is_agent,
            'type' => $this->type,
            'tax_identifier' => $this->tax_identifier,
            'phone' => $this->phone,
            'email' => $this->email,
            'credit_limit' => $this->credit_limit,
            'credit_days' => $this->credit_days,
            'price_list_id' => $this->priceList?->uuid,
            'tax_profile_id' => $this->taxProfile?->uuid,
            'opening_balance' => $this->opening_balance,
            'current_balance' => $this->current_balance,
            'assigned_to' => $this->assignee?->uuid,
            'status' => $this->status,
            'addresses' => $this->relationLoaded('addresses')
                ? $this->addresses->map(static fn (PartyAddress $a): array => [
                    'id' => $a->uuid,
                    'type' => $a->type,
                    'label' => $a->label,
                    'contact_name' => $a->contact_name,
                    'phone' => $a->phone,
                    'line1' => $a->line1,
                    'line2' => $a->line2,
                    'area' => $a->area,
                    'city' => $a->city,
                    'district' => $a->district,
                    'postal_code' => $a->postal_code,
                    'country_code' => $a->country_code,
                    'latitude' => $a->latitude,
                    'longitude' => $a->longitude,
                    'is_default' => $a->is_default,
                ])->all()
                : [],
            'contacts' => $this->relationLoaded('contacts')
                ? $this->contacts->map(static fn (PartyContact $c): array => [
                    'id' => $c->uuid,
                    'name' => $c->name,
                    'designation' => $c->designation,
                    'phone' => $c->phone,
                    'email' => $c->email,
                    'is_primary' => $c->is_primary,
                ])->all()
                : [],
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
