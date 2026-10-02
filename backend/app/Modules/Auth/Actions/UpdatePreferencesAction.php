<?php

declare(strict_types=1);

namespace App\Modules\Auth\Actions;

use App\Core\Actions\Action;
use App\Models\User;

/**
 * Update User Preferences Action (API_CONTRACT §8.5).
 */
class UpdatePreferencesAction extends Action
{
    /**
     * Execute preferences update.
     *
     * @param  array{
     *     user: User,
     *     locale?: string,
     *     theme?: string,
     *     reduced_motion?: bool,
     *     density?: string,
     *     landing_page?: string
     * }  $input
     * @return array<string, mixed>
     */
    public function execute(array $input): array
    {
        /** @var User $user */
        $user = $input['user'];

        $updates = [];
        if (isset($input['locale'])) {
            $updates['locale'] = $input['locale'];
        }

        if (! empty($updates)) {
            $user->update($updates);
        }

        return [
            'locale' => $user->locale ?? 'en',
            'theme' => (string) ($input['theme'] ?? 'light'),
            'reduced_motion' => (bool) ($input['reduced_motion'] ?? false),
            'density' => (string) ($input['density'] ?? 'comfortable'),
            'landing_page' => (string) ($input['landing_page'] ?? '/dashboard'),
        ];
    }
}
