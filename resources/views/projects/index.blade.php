<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            {{ __('Projects') }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white overflow-hidden shadow-sm sm:rounded-lg">
                <div class="p-6 text-gray-900">
                    <p class="font-medium">{{ __('Projects are built in phase 2.') }}</p>
                    <p class="mt-2 text-sm text-gray-600">
                        {{ __('This page becomes the project list, with each project tied to a client, an hourly rate, and an active or archived status.') }}
                    </p>
                </div>
            </div>
        </div>
    </div>
</x-app-layout>
