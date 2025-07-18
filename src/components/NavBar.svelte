<script>
	import { Navbar, NavBrand, NavLi, NavUl, NavHamburger } from 'flowbite-svelte';
</script>

<Navbar>
	<NavBrand href="/">
		<span class="self-center text-xl font-semibold whitespace-nowrap dark:text-white">Flowbite</span
		>
	</NavBrand>
	<NavHamburger />
	<NavUl>
		<NavLi href="/">Dashboard</NavLi>
		<NavLi href="/projects">Projects</NavLi>
		<NavLi href="/tasks">Tasks</NavLi>
		<NavLi href="/subtasks">Subtasks</NavLi>
		<NavLi href="/architects">Architects</NavLi>
	</NavUl>
</Navbar>
