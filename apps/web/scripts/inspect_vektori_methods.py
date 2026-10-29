import vektori
print('Vektori class dir:')
print([a for a in dir(vektori.Vektori) if not a.startswith('_')])
try:
    help_text = vektori.Vektori.__doc__
    print('\nDocstring snippet:', help_text.split('\n')[0:10])
except Exception as e:
    print('doc error', e)
