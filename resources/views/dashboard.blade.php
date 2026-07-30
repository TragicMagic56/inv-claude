<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            {{ __('Dashboard') }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">

            {{-- Summary tiles. Real figures are wired up in phase 6. --}}
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div class="bg-white shadow-sm sm:rounded-lg p-6">
                    <div class="text-sm font-medium text-gray-500">{{ __('Outstanding') }}</div>
                    <div class="mt-1 text-2xl font-semibold text-gray-400">&mdash;</div>
                </div>

                <div class="bg-white shadow-sm sm:rounded-lg p-6">
                    <div class="text-sm font-medium text-gray-500">{{ __('Paid this month') }}</div>
                    <div class="mt-1 text-2xl font-semibold text-gray-400">&mdash;</div>
                </div>

                <div class="bg-white shadow-sm sm:rounded-lg p-6">
                    <div class="text-sm font-medium text-gray-500">{{ __('Draft invoices') }}</div>
                    <div class="mt-1 text-2xl font-semibold text-gray-400">&mdash;</div>
                </div>

                <div class="bg-white shadow-sm sm:rounded-lg p-6">
                    <div class="text-sm font-medium text-gray-500">{{ __('Unbilled hours') }}</div>
                    <div class="mt-1 text-2xl font-semibold text-gray-400">&mdash;</div>
                </div>
            </div>

            <div class="bg-white overflow-hidden shadow-sm sm:rounded-lg">
                <div class="p-6 text-gray-900">
                    <p class="font-medium">{{ __('Foundation is in place.') }}</p>
                    <p class="mt-2 text-sm text-gray-600">
                        {{ __('Auth, the database tables and the section navigation are ready. Each section is filled in over the phases that follow.') }}
                    </p>
                </div>
            </div>

        </div>
    </div>
</x-app-layout>
